# QEC Visualization for Feynman Circuits — Rotated d=3 Surface Code Memory

## Context

Feynman Circuits (FC) is a quantum circuit visualization platform (SvelteKit frontend + Django backend). This plan adds a supervisor-approved, 12-week-scoped QEC feature: one rotated distance-3 surface code memory experiment (9 data qubits, 8 ancillas), user-injected deterministic Pauli errors at chosen (qubit, pauli, round), multi-round stabilizer measurements and detection events (syndrome[r] XOR syndrome[r−1]), Stim-generated syndromes, PyMatching MWPM decoding, matching/correction visualization, and a logical success/failure verdict — validated against Stim's raw output. Everything is **additive**: the existing CircuitIR, simulator, and editor are untouched.

Decisions locked: deterministic injections at user-chosen rounds (no background noise in core); compute in the existing Django backend via a new endpoint; new dedicated `/qec` frontend route.

## Verified existing architecture

- **Truth/IR layer** (`frontend/src/lib/IR/`): `schema.ts` (`CircuitIR` = flat op list keyed by `column`), `stores.ts` (writable stores `circuitIR`, `simulationResult`), `operations.ts` (mutators), `validate.ts`. Pure math in `frontend/src/lib/quantum/`. Hand-written dense statevector simulator `frontend/src/lib/circuit/simulator.ts`, capped at 8 qubits (d=3 needs 17 → another reason Stim does the QEC simulation).
- **UI boundary confirmed**: `frontend/src/lib/` has no Svelte components/DOM logic; UI lives in `frontend/src/components/` + `frontend/src/routes/`, consuming stores via `$store` auto-subscription. The lib layer's only Svelte dependency is `svelte/store` as state transport.
- **Svelte 5 in legacy style** (writable stores + `export let` props, not runes). Follow that style.
- **Backend is Django + DRF** (`backend/`, apps `accounts`, `circuits`; dormant `jobs` not in `INSTALLED_APPS`). Frontend calls it via axios (`frontend/src/lib/api/axios.ts`, `circuitApi.ts`). DRF defaults: `CookieJWTAuthentication` + `AnonRateThrottle` "anon": "100/hour" (`backend/config/settings.py:159-171`). `AllowAny` precedent exists in `backend/accounts/views.py`.
- **No existing concept** of ancillas/roles, stabilizers, rounds, or timelines — the QEC structures below are new, isolated in `frontend/src/lib/qec/` + `backend/qec/`.
- Tests: frontend Vitest (`frontend/tests/`, golden style per `tests/circuit/simulator.golden.test.ts`); backend `manage.py test`; CI `.github/workflows/test.yml` installs `backend/requirements.txt` (Python 3.12/linux) so new deps flow into CI automatically.

## 1. Data model (new, additive)

### Layout — `frontend/src/lib/qec/schema.ts` + `layout.ts` (mirrored in `backend/qec/layout.py`)

Stim-style coords (data at odd–odd, checks at even–even, y down). Data qubits 0–8:
`0:(1,1) 1:(3,1) 2:(5,1) / 3:(1,3) 4:(3,3) 5:(5,3) / 6:(1,5) 7:(3,5) 8:(5,5)`

| id | type | coords | data qubits |
|----|------|--------|-------------|
| X0 | X | (2,2) | 0,1,3,4 |
| X1 | X | (4,4) | 4,5,7,8 |
| X2 | X | (4,0) | 1,2 |
| X3 | X | (2,6) | 6,7 |
| Z0 | Z | (4,2) | 1,2,4,5 |
| Z1 | Z | (2,4) | 3,4,6,7 |
| Z2 | Z | (0,2) | 0,3 |
| Z3 | Z | (6,4) | 5,8 |

Logical Z = data `[0,1,2]`. Sanity anchors: X@q4 → Z0+Z1 fire; X@q0 (corner) → Z2 only; Z@q4 → X0+X1; Y@q4 → all four of those.

```ts
export type Pauli = 'X' | 'Y' | 'Z';
export type CheckType = 'X' | 'Z';
export interface DataQubit { id: number; x: number; y: number; }
export interface Check { id: string; type: CheckType; x: number; y: number; dataQubits: number[]; }
export interface SurfaceCodeLayout { distance: 3; dataQubits: DataQubit[]; checks: Check[]; logicalZ: number[]; }

export interface InjectedError { qubit: number; pauli: Pauli; round: number; } // applied BEFORE round's measurement
export interface QecRequest { rounds: number; errors: InjectedError[]; }       // rounds 1..15, ≤20 errors

export type StepPhase = 'inject' | 'measure' | 'decode';
export interface TimelineSnapshot {
  round: number;
  phase: StepPhase;
  syndrome: Record<string, 0 | 1>;         // checkId -> frame-corrected syndrome (cumulative XOR of events)
  detectionEvents: Record<string, 0 | 1>;  // checkId -> fired this round
  errorsSoFar: InjectedError[];
}
export interface DetectorRef { round: number; checkId: string; }
export type MatchingEdge =
  | { kind: 'pair'; a: DetectorRef; b: DetectorRef }
  | { kind: 'boundary'; a: DetectorRef };
export interface LogicalVerdict { observedFlip: 0 | 1; predictedFlip: 0 | 1; success: boolean; }

export interface QecResult {
  layout: SurfaceCodeLayout;               // echoed by backend — FE/BE drift guard
  request: QecRequest;
  timeline: TimelineSnapshot[];            // 2*rounds + 1 (inject+measure per round, final decode step)
  matching: MatchingEdge[];                // [] until Phase 4
  correction: { qubit: number; pauli: Pauli }[];
  logical: LogicalVerdict | null;
}
```

Key semantics (document in code):
- **`syndrome` is frame-corrected** (cumulative XOR of detection events). Raw first-round X-check outcomes are nondeterministic (reference frame); detection events are the primary quantity. Round 0 has detectors for Z checks only (deterministic vs |0⟩); X checks show `detectionEvents=0` at round 0 by definition.
- **Timeline steps**: per round `inject` then `measure`; one final `decode` step where matching/correction/verdict appear. Scrubber indexes this array.

### Stores — `frontend/src/lib/qec/stores.ts` (mirrors `IR/stores.ts` pattern)

```ts
export const qecResult = writable<QecResult | null>(null);
export const currentStep = writable<number>(0);
export const highlightedCheck = writable<string | null>(null);
export const currentSnapshot = derived([qecResult, currentStep], ...);
```

Both panels are pure functions of `$currentSnapshot` + `$highlightedCheck` (+ `$qecResult` for the decode overlay). They never message each other — same consumption pattern as `$circuitIR`/`$simulationResult`.

### JSON contract

Response body **is** `QecResult`, camelCase (TS types are the contract; matches how `ir` is stored camelCase today). Matching edges reference `{round, checkId}`, never Stim's flat detector index — the backend owns that translation. Errors: 400 `{detail: string}`. API module `frontend/src/lib/api/qecApi.ts`: `simulateQec(request) → POST /qec/api/simulate/`.

## 2. Backend design — new `backend/qec/` app

New app (NOT the dormant `jobs` app: wrong name/connotation, model baggage, invites queueing scope creep). Stateless — no models/migrations.

```
backend/qec/
  urls.py           # path("api/simulate/", QecSimulateView.as_view())
  views.py          # APIView: permission_classes=[AllowAny], authentication_classes=[]
  serializers.py    # request validation: rounds 1–15; ≤20 errors; qubit 0–8; pauli X/Y/Z; round in [0, rounds); reject exact-duplicate triples
  layout.py         # D3_LAYOUT mirror (golden test pins FE/BE equality)
  stim_builder.py   # QecRequest -> (noiseless sim circuit, noisy reference circuit)
  decode.py         # pymatching wiring, edge -> (round, checkId), edge -> correction
  timeline.py       # detector bits -> TimelineSnapshot[]
  tests.py
  scripts/gen_fixtures.py
```

Wire-up: add `"qec"` to `INSTALLED_APPS`; `path("qec/", include("qec.urls"))` in `backend/config/urls.py`. Add to `backend/requirements.txt`: `stim`, `pymatching>=2.1` (needs `decode_to_edges_array`), `numpy` (currently absent). Add scoped throttle `"qec": "600/hour"` on the view (default anon 100/hour is tight for live demos; scrubbing is client-side so only config changes POST).

### Stim circuit: hand-written (not the `surface_code:rotated_memory_z` generator)

Rationale: injections must be spliced at specific rounds (would require slicing the generated circuit anyway); hand-building lets us **choose** `DETECTOR(x, y, r)` = our exact check coords (no reverse-engineering stim's convention); ~80 lines and pedagogically valuable for the report. Keep the generator as a cross-check in tests only.

Per round r (data 0–8, ancillas 9–16 in check-table order):
1. Injected Paulis for round r as literal X/Y/Z **gates** (not noise channels) — deterministic.
2. Stabilizer cycle: `R` ancillas; `H` X-ancillas; 4 CX layers in the standard zigzag schedule (X-checks ancilla→data, Z-checks data→ancilla — order matters even noiselessly; quiescent test is the tripwire); `H` X-ancillas; `M` ancillas.
3. Detectors: round 0 → Z checks only; rounds ≥1 → all 8 vs previous round. Every detector annotated `(check.x, check.y, r)`.
Final: `M` data; `OBSERVABLE_INCLUDE(0)` over data [0,1,2]. (Optional final data-measurement detector layer — decide in Phase 3.)

Sampling: `sim_circuit.compile_detector_sampler().sample(1, separate_observables=True)` → deterministic detection events + `observedFlip`.

### Decoding: reference DEM + PyMatching

Noiseless sim circuit has an empty DEM, so build a **reference circuit** (same builder, no injections) with phenomenological noise: `X_ERROR(p)`/`Z_ERROR(p)` on data before each cycle **and measurement-flip noise** (required — creates the time-like edges without which multi-round patterns are unmatchable), p=0.01 nominal. Then:

```python
dem = ref_circuit.detector_error_model(decompose_errors=True)  # mandatory for Y decomposition
matching = pymatching.Matching.from_detector_error_model(dem)
prediction = matching.decode(detection_vector)                  # predictedFlip
edges = matching.decode_to_edges_array(detection_vector)        # -1 = boundary
```

Map edges to `MatchingEdge[]` via `get_detector_coordinates()` (assert sim/ref detector ordering identical). Correction inferred **geometrically** (unambiguous at d=3): same-round pair of checks → unique shared data qubit (Pauli X if Z-checks, Z if X-checks); boundary edge → the check's boundary qubit; time-like edge → no data correction (vertical wire-panel link). Fallback API: `decode_to_matched_dets_array`.

## 3. Phased build order (vertical slice first — 12 weeks)

- **Phase 0 (wk 1) — Static lattice.** `lib/qec/{schema,layout,stores}.ts`; route `frontend/src/routes/qec/+page.svelte`; `frontend/src/components/Qec/LatticePanel.svelte` (SVG 3×3 grid + 8 plaquettes from `D3_LAYOUT`; hover sets `highlightedCheck`). Vitest layout invariants (commutation via overlap parity; logicalZ even-overlaps all X checks). Also week 1: `pip install stim pymatching` in the Windows venv to burn down the wheels risk early.
- **Phase 1 (wks 2–3) — Single-round slice on fixtures.** `gen_fixtures.py` (stim only) emits `QecResult` JSONs (timeline only) for canned scenarios (quiet, X@q4, X@q0, Z@q4, Y@q4) → checked into `frontend/tests/qec/fixtures/` → scenario dropdown on `/qec` loads into `qecResult` → checks light up. **No client-side syndrome math ever — stim is the sole truth.** *Demo: pick a canned error, correct checks fire.*
- **Phase 2 (wks 4–5) — Endpoint live.** `qec` app, builder, timeline, serializer, view (matching `[]`, logical `null`); `qecApi.ts`; injection UI (click qubit → pick Pauli/round) wired to POST. Backend goldens + determinism test; CI green with new deps. *Demo: arbitrary injections, live.*
- **Phase 3 (wks 6–7) — Multi-round + wire panel + scrubber.** Rounds selector; `StepScrubber.svelte` → `currentStep`; `WirePanel.svelte` (8 ancilla wires × rounds, 0/1 + detection marks); cross-highlight via `highlightedCheck`. Decide final-measurement-round display. *Demo: scrub 5 rounds, events appear once, syndrome persists.*
- **Phase 4 (wks 8–9) — Decode + matching viz + verdict.** `decode.py`; populate `matching`/`correction`/`logical`; matching lines + boundary stubs on lattice; correction overlay; `VerdictBanner.svelte`. *Demo: full supervisor-approved scope.*
- **Phase 5 (wk 10) — Validation suite.** Full golden battery (below), FE/BE layout drift test, `validateQecResult()` run over all fixtures, fixture-regen script so fixtures can't silently go stale, decoder-failure/undetectable-logical UI states.
- **Phase 6 (wks 11–12) — Polish, deploy, write-up + slack.** Backend redeploy with new deps; Vercel env/CORS check; nav link; loading/error states; README/report material. Week 12 = deliberate slack; at most ONE stretch item if free.

Every phase ends demoable; nothing in phase N+1 blocks demoing phase N.

## 4. Core vs stretch

**Core:** rotated d=3 memory-Z; deterministic (qubit, pauli, round) injections; multi-round syndrome + detection events; two synced panels + scrubber + hover-highlight; Stim truth + PyMatching MWPM; matching/correction/verdict; validation vs stim.

**Stretch (post-Phase 6, max one):** distance-5; circuit-level/background noise toggle; explicit ancilla gate animation; raw-syndrome vs detection-event toggle; final-round data-measurement column; "after correction" lattice view.

## 5. Validation strategy

Backend goldens (`backend/qec/tests.py`), each asserting events + matching + verdict:
1. Quiescent (5 rounds): all detectors 0, success — proves the CX schedule.
2. X@q4@r1 → exactly Z0+Z1 at r1, paired, correction {q4:X}, success.
3. X@q0@r0 (corner) → Z2 only, boundary match, success.
4. Z@q4 → X0+X1, success (Z can't flip logical Z).
5. Y@q4 → Z0,Z1,X0,X1 all fire; guards `decompose_errors=True`.
6. Two-error string (X@q1 + X@q4, same round) → events at string endpoints, matched, success.
7. Undetectable logical X@q0,q1,q2 → zero events, observedFlip=1, predictedFlip=0, **failure**.
8. Decoder-failure case (e.g. X@q0+X@q2): MWPM boundary-pairs and completes the logical → failure (pin exact expectation from tool output when writing).
9. Multi-round X@q4@r1 + X@q1@r3 → exercises time-separated events / time-like edges.
10. Consistency: endpoint timeline == raw `compile_detector_sampler()` bits reshaped; detector-coordinate map bijective onto (round, check).
11. Determinism: identical request → byte-identical response.

Frontend (`frontend/tests/qec/`): layout invariants; `lib/qec/validate.ts` `validateQecResult()` (mirrors `IR/validate.ts`, no new deps) over every fixture; FE `D3_LAYOUT` deep-equals backend fixture `layout` (drift guard); pure timeline-utility tests.

## 6. Risks / unknowns to resolve before coding

1. **stim/pymatching Windows wheels** vs the actual `backend/venv` Python (3.12.0 — wheels exist; verified import path pending install) — verify week 1 (CI 3.12/linux is fine).
2. **First-round X-check nondeterminism** — solved by frame-corrected design; UI copy must not present ancilla values as raw measurements.
3. **Time-like edges** require measurement noise in the reference DEM (golden #9 guards).
4. **Y decomposition** requires `decompose_errors=True` (golden #5 guards).
5. **`decode_to_edges_array` version sensitivity** — pin `pymatching>=2.1`; fallback documented.
6. **CX schedule ordering** — quiescent test is the tripwire; use standard zigzag.
7. **Boundary-stub rendering** — stub toward nearest boundary; corners touch two, either acceptable.
8. **Pairs vs paths** — render straight lines between matched plaquettes (paths ≤ 2 at d=3).
9. **Deployment/throttle** — scoped `"qec"` throttle; backend host rebuild with new requirements; confirm CORS/`VITE_API_BASE_URL` reach `/qec/`.
10. **Sim vs reference detector-index drift** — same builder for both + `get_detector_coordinates()` assertion.

## Verification (end-to-end)

- Per phase: `cd frontend && npm run lint && npm run check && npx vitest run`; `cd backend && python manage.py test qec`.
- Phase 2+: run Django locally (`python manage.py runserver`) + `npm run dev`, open `/qec`, inject X@q4 → verify Z0+Z1 light up; compare a raw endpoint response against `compile_detector_sampler()` output in a shell.
- Phase 4: reproduce goldens #2/#3/#7 through the UI and confirm matching lines + verdict match the test expectations.
- CI: `.github/workflows/test.yml` picks up backend deps automatically; confirm both jobs green.
