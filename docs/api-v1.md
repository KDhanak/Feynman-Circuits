# Feynman Circuits Open API (v1)

A public, unauthenticated API for moving quantum circuits between platforms.

Two things it lets you do:

- **Send a circuit to Feynman Circuits.** Put an "Open in Feynman Circuits" button in your app;
  the user clicks it and lands on the builder with their circuit already on the board.
- **Read a circuit out of Feynman Circuits.** Fetch any circuit whose owner has published it.

No API key, no account, no OAuth. Circuits are exchanged as **Circuit IR v1.0** documents —
JSON Schema at [`shared/circuit-ir.schema.json`](../shared/circuit-ir.schema.json).

- Base URL: `https://<api-host>/api/v1/`
- Interactive docs: `/api/v1/docs/` · OpenAPI 3 schema: `/api/v1/schema/`
- CORS: open to every origin. Requests must **not** send credentials.

---

## Sending a circuit to Feynman Circuits

There are two transports. Both end with the user on the builder with their circuit loaded, and
both show a confirmation dialog first — a link never silently replaces whatever the user already
has on their board.

|                    | Inline link                                          | Handoff token                             |
| ------------------ | ---------------------------------------------------- | ----------------------------------------- |
| Server call needed | No                                                   | Yes, one POST                             |
| Circuit size       | Up to ~8 KB encoded                                  | Any valid circuit                         |
| Payload visibility | Stays in the URL fragment — never sent to any server | Stored server-side for 24 h               |
| Best for           | The common case                                      | Large circuits, or server-to-server flows |

### Transport A — inline link

Base64url-encode a small JSON envelope and hang it off the URL **fragment**:

```
https://<app-host>/#handoff=<base64url payload>
```

The envelope:

```json
{
  "v": 1,
  "name": "Bell State",
  "source": "quantumcanvas",
  "ir": { "...Circuit IR v1.0..." }
}
```

Minimal JavaScript implementation:

```js
function openInFeynmanCircuits(ir, name) {
  const payload = { v: 1, name, source: "quantumcanvas", ir };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `https://<app-host>/#handoff=${b64}`;
}
```

Why the fragment and not a query parameter: fragments are never transmitted to a server, so a
circuit shared this way never appears in an access log, a proxy cache, or a `Referer` header — and
it is not subject to any server's request-line length limit.

**Optional gzip.** The decoder sniffs the gzip magic bytes (`0x1f 0x8b`) after base64-decoding, so
you may compress the JSON with gzip before encoding and use the exact same link format. Worth
doing for dense circuits: a maximally dense circuit is ~38 KB of base64 uncompressed and about
1.2 KB gzipped. Use `CompressionStream('gzip')` in the browser or `zlib.gzipSync` in Node.

**Size limit: 8192 characters** of encoded payload. Past that the link is rejected with a clear
error rather than truncated — use the token transport instead.

**Drop the per-operation `id` fields.** They are regenerated on import and account for roughly a
third of an uncompressed payload.

### Transport B — handoff token

#### `POST /api/v1/handoffs/`

Park a circuit and get back a link.

```bash
curl -X POST https://<api-host>/api/v1/handoffs/ \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Bell State",
    "source": "quantumcanvas",
    "ir": {
      "version": "1.0",
      "registers": { "q": 2, "c": 0 },
      "qubitLabels": ["Qubit 0", "Qubit 1"],
      "operations": [
        { "kind": "unitary", "gate": "h", "column": 0,
          "targets": [0], "controls": [], "antiControls": [], "params": [] },
        { "kind": "unitary", "gate": "x", "column": 1,
          "targets": [1], "controls": [0], "antiControls": [], "params": [] }
      ]
    }
  }'
```

**201 Created**

```json
{
  "token": "PZ8mS3v...",
  "open_url": "https://<app-host>/?handoff=PZ8mS3v...",
  "api_url": "https://<api-host>/api/v1/handoffs/PZ8mS3v.../",
  "expires_at": "2026-08-18T21:30:00Z"
}
```

Point your button at `open_url`.

| Field    | Required | Notes                                                                |
| -------- | -------- | -------------------------------------------------------------------- |
| `ir`     | yes      | Circuit IR v1.0 document                                             |
| `name`   | no       | Shown in the confirmation dialog. Defaults to `Imported Circuit`.    |
| `source` | no       | Your platform's name, shown to the user as the sender. Max 64 chars. |

Errors: **400** invalid IR (the body names the failing operation), **413** body over 256 KB,
**429** rate limited (30 requests/hour per IP).

#### `GET /api/v1/handoffs/{token}/`

Read a parked handoff. The app calls this itself when the user follows the link; you generally do
not need it.

Reads do **not** consume the token — refreshing, going back, or opening the link on a second device
all keep working. Tokens expire 24 hours after creation, after which this returns **404**.

---

## Reading a circuit out of Feynman Circuits

### `GET /api/v1/circuits/{circuit_id}/`

```bash
curl https://<api-host>/api/v1/circuits/3f8a2b10-.../
```

**200 OK**

```json
{
  "circuit_id": "3f8a2b10-...",
  "name": "Bell State",
  "description": "",
  "ir": { "...Circuit IR v1.0..." },
  "created_at": "2026-08-17T12:00:00Z",
  "updated_at": "2026-08-17T12:30:00Z"
}
```

Only circuits the owner has published are readable. A user publishes one from their circuit
library: right-click → **Share Publicly**, which also copies the share link
(`https://<app-host>/?circuit=<circuit_id>`). **Make Private** revokes it.

The response never identifies the owner. Private and non-existent circuits both return **404** —
deliberately indistinguishable, so the endpoint cannot be used to discover which circuit ids exist.

Rate limit: 600 requests/hour per IP.

---

## Circuit IR v1.0

A circuit is a flat list of operations. Layout is carried by an integer `column` on each operation
rather than by nesting.

```json
{
  "version": "1.0",
  "registers": { "q": 2, "c": 0 },
  "qubitLabels": ["Qubit 0", "Qubit 1"],
  "operations": [
    {
      "kind": "unitary",
      "gate": "h",
      "column": 0,
      "targets": [0],
      "controls": [],
      "antiControls": [],
      "params": []
    }
  ]
}
```

**Operation kinds:** `unitary`, `measure`, `reset`, `barrier`.

- `unitary` — `targets`, `controls`, `antiControls`, `params`
- `measure` — `targets`, `classicalTargets`
- `reset`, `barrier` — `targets`

**Gates** (from [`shared/gates.json`](../shared/gates.json)):

| Gate                    | Targets | Params      |
| ----------------------- | ------- | ----------- |
| `x` `y` `z` `h` `s` `t` | 1       | 0           |
| `p` `rx` `ry` `rz`      | 1       | 1 (radians) |
| `swap`                  | 2       | 0           |

Controls are expressed on the operation, not as separate gates: a CNOT is an `x` with
`controls: [c]`. `antiControls` fire on |0⟩ instead of |1⟩.

**Limits**

|                        |      |
| ---------------------- | ---- |
| Qubits (`registers.q`) | 1–8  |
| Columns (`column`)     | 0–29 |
| Operations             | 240  |

Validation is strict, because the input comes from outside. Qubit indices must be inside the
register; a qubit cannot be both a target and a control of the same operation; parametric gates
must carry exactly their parameter count; `qubitLabels`, when present, must have one entry per
qubit. A rejection names the offending operation by index.

---

## Notes for implementers

- **Send no credentials.** These endpoints answer `Access-Control-Allow-Origin: *`, which browsers
  refuse to honour on a request carrying cookies. Use `credentials: 'omit'` (the `fetch` default is
  `same-origin`, which is fine cross-origin, but be explicit if you wrap it).
- **Preflight** is answered for `POST` with `Content-Type: application/json` and cached for 24 h.
- **Versioning.** `/api/v1/` is a stable contract. Breaking changes go to `/api/v2/`. The endpoints
  under `/circuits/` and `/accounts/` are internal to the app, are not published in the OpenAPI
  schema, and may change without notice — do not build against them.
