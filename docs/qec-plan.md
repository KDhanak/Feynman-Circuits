# QEC Mode for Feynman Circuits — Rotated d=3 Surface Code Memory

## Context

Feynman Circuits (FC) is a quantum circuit visualization platform (SvelteKit frontend + Django backend). This plan covers its quantum-error-correction mode: one rotated distance-3 surface code memory experiment (9 data qubits, 8 ancillas), user-injected deterministic Pauli errors at chosen (qubit, pauli, round), multi-round stabilizer measurements and detection events (syndrome[r] XOR syndrome[r−1]), Stim-generated syndromes, PyMatching MWPM decoding, matching/correction visualization, and a logical success/failure verdict — validated against Stim's raw output. Everything is **additive**: the existing CircuitIR, simulator, and editor are untouched.

Decisions locked: deterministic injections at user-chosen rounds (no background noise in core); compute in the existing Django backend; QEC is a mode inside the main editor (not a separate route).

## Progress snapshot (2026-10-14)

Verified against the code. Phases 1 and 3 are built (and in places go further than planned); phase 5 is mostly done, phase 4 is half done; phases 2 and 6 are not started.

| Phase | Plan | Status | Evidence |
|---|---|---|---|
| 1 | Static lattice | ✅ Done, relocated | `lib/qec/{schema,layout,stores}.ts`, `components/Qec/LatticePanel.svelte` + its test, layout invariants in `frontend/tests/qec/layout.test.ts`. **Deviation:** there is no `/qec` route. QEC is a mode inside the main editor — `qecMode` store, QEC button in `GatePalette.svelte`, panel swapped into the results row in `routes/+page.svelte`. |
| 2 | Scenario library on fixtures | ❌ Not started | No `backend/qec/scripts/gen_fixtures.py`, no `frontend/tests/qec/fixtures/`, no scenario picker, no `lib/qec/validate.ts`. The FE/BE layout guard exists in a different form: `qec/tests.py::LayoutGoldenTest` parses the TypeScript source and compares it to `layout.py`. |
| 3 | Endpoint live + injection ledger | ✅ Done, and beyond scope | `backend/qec/` app with `POST /qec/api/qec/run/` wired through `qecApi.ts`; injection ledger, Pauli picker, round and rounds selectors and Run in `QecPanel.svelte`; backend tests including the corner error, the Y error, the undetectable chain and both decoder outcomes; deps pinned; `qec_run` throttled. Beyond the plan: `GET /qec/api/qec/layout/` and `POST /qec/api/qec/error-rate/` (a many-shot logical-error-rate sweep) exist, but **nothing on the frontend calls either** — the error-rate endpoint in particular is a whole capability with no UI. |
| 4 | Multi-round + wire panel + scrubber | 🟡 Half | The rounds selector and the step control are in `QecPanel.svelte` (the scrubber, inlined rather than a separate `StepScrubber.svelte`). **`WirePanel.svelte` does not exist**, so there is no ancilla-wire timeline and no cross-panel highlight: `highlightedCheck` is written by lattice hover and read by nothing else. |
| 5 | Decode + matching viz + verdict | 🟡 Mostly | The backend decodes and returns `inferred.matching` plus the verdict. On the decode step `LatticePanel.svelte` draws the matching as dashed slate marks (`--color-inferred`): a line for a pair, a stub with an end bar for a boundary edge, a ring for a check paired with itself across rounds. The geometry is in `lib/qec/matching.ts`. The legend's three layer entries are checkboxes that write `visibleLayers`, and `QecPanel.svelte` lists the pairings in words with their rounds. **Still missing:** `correction` is returned empty by design (`experiment.py`), so there is no correction overlay; no `VerdictBanner.svelte`; goldens 8, 10, 12. |
| 6 | Polish + deploy | ❌ Not started | The backend deps are pinned and the app is wired into `INSTALLED_APPS` and `config/urls.py`, so the deploy step is mostly redeployment. |

**Two gaps the plan does not cover, found in the code:**

1. **QEC mode is reachable on mobile but its panel is not.** The QEC button in `GatePalette.svelte` is not gated by `isMobile`, while the panel renders only when `qecTakeover = $qecMode && !$isMobile` (`routes/+page.svelte`). On a phone, turning QEC on restricts the palette to one logical qubit and Clifford gates and shows nothing in return.
2. **The circuit wire is not connected to the experiment** (the open note from commit `1fd2abc`). `QecRequest` is `{rounds, errors}`, so Clifford gates placed on the `|0⟩ᴸ` wire never reach the backend. Closing this means deciding how logical gates act on the encoded qubit — transversal X/Z are cheap, H needs a lattice rotation, S is not transversal at d=3 — and this plan scopes the experiment as *not* encoding the user's circuit. Decide the physics story before writing code.

**Next step:** phase 4's `WirePanel.svelte` (ancilla wires × rounds, sharing `currentStep` and `highlightedCheck` with the lattice), then the phase 2 scenario library. The correction overlay waits until the backend can map matching edges back to data qubits.

---

## The bigger picture: build, perturb, protect

QEC mode is the third step of a three-step story the platform can tell:

1. **Build** — the circuit does what you intended. *(exists today in the editor)*
2. **Perturb** — inject an error, watch the result go wrong. Teaches **what errors do**: the problem. *(not built — see §5)*
3. **Protect** — errors are found and corrected without ever measuring the data. Teaches **how the field fights back**: the solution. *(this plan)*

Step 3 currently arrives without step 2, so the tool shows a solution to a problem the user has never watched fail.

**Where the two halves do not join.** Steps 2 and 3 do not compose computationally. Step 2 would be up to 8 unencoded qubits on the dense statevector simulator; step 3 is 17 physical qubits on a stabiliser simulator, holding one logical qubit that does nothing. They share a story and an error model — deterministic Pauli injection — and they are **not** an end-to-end fault-tolerant pipeline. A user who came away thinking "I built a circuit and the surface code protected it" would have learned something false. The UI copy has to rule that reading out.

## Verified existing architecture

- **Truth/IR layer** (`frontend/src/lib/IR/`): `schema.ts` (`CircuitIR` = flat op list keyed by `column`), `stores.ts` (writable stores `circuitIR`, `simulationResult`), `operations.ts` (mutators), `validate.ts`. Pure math in `frontend/src/lib/quantum/`. Hand-written dense statevector simulator `frontend/src/lib/circuit/simulator.ts`, capped at 8 qubits (`MAX_QUBITS` in `lib/utils/constants.ts`; d=3 needs 17 → another reason Stim does the QEC simulation).
- **UI boundary**: `frontend/src/lib/` has no Svelte components/DOM logic; UI lives in `frontend/src/components/` + `frontend/src/routes/`, consuming stores via `$store` auto-subscription. The lib layer's only Svelte dependency is `svelte/store`.
- **Svelte 5 in legacy style** (writable stores + `export let` props, not runes). Follow that style.
- **Backend is Django + DRF** (`backend/`, apps `accounts`, `circuits`, `qec`; dormant `jobs` not in `INSTALLED_APPS`). Frontend calls it via axios (`frontend/src/lib/api/axios.ts`, `circuitApi.ts`, `qecApi.ts`).
- **No shared concept** of ancillas/roles, stabilizers, rounds, or timelines with the circuit editor — the QEC structures are isolated in `frontend/src/lib/qec/` + `backend/qec/`.
- Tests: frontend Vitest (`frontend/tests/`, golden style per `tests/circuit/simulator.golden.test.ts`); backend `manage.py test`; CI `.github/workflows/test.yml` installs `backend/requirements.txt` (Python 3.12/linux) so new deps flow into CI automatically.

### The editor's results panels are not reused in QEC mode

`CircuitDataPanel`, `SimulationResult` and `OverallBlochSphere` are not portable here: the first serializes a `CircuitIR` that a QEC run does not have, and the latter two read `$simulationResult` — a statevector that does not exist on this path and could not be produced anyway at 17 qubits against `MAX_QUBITS = 8`. Rendering an averaged Bloch vector over an encoded 17-qubit state would make QEC look simpler than it is while hiding what was left out. Recorded here because the question comes up again and again.

## 1. Data model

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
export interface DetectorRef { round: number; checkId: string; }
export type MatchingEdge =
  | { kind: 'pair'; a: DetectorRef; b: DetectorRef }
  | { kind: 'boundary'; a: DetectorRef };
export interface LogicalVerdict { observedFlip: 0 | 1; predictedFlip: 0 | 1; success: boolean; }
```

### The three layers — kept apart in the types, not just in the drawing

The tool must keep physical errors, measured syndromes and decoder guesses clearly apart. That is a correctness rule, not a styling choice, so the types enforce it: three named layers that no panel can mix up by accident, because mixing them would not typecheck.

```ts
/** Layer 1 — GROUND TRUTH. Known only because the user injected it.
 *  On real hardware this layer cannot be seen; that difference is the
 *  single most important thing the tool has to teach. */
export interface PhysicalErrorLayer {
  injected: InjectedError[];               // cumulative, in injection order
}

/** Layer 2 — MEASURED. What the ancillas actually report. Everything a
 *  real decoder is ever allowed to see. */
export interface SyndromeLayer {
  syndrome: Record<string, 0 | 1>;         // checkId -> frame-corrected (cumulative XOR of events)
  detectionEvents: Record<string, 0 | 1>;  // checkId -> fired this round
}

/** Layer 3 — INFERRED. The decoder's guess. It fits layer 2 but is NOT
 *  layer 1 and may differ from it — the tool must never present a
 *  correction as "the error that happened". */
export interface DecoderInferenceLayer {
  matching: MatchingEdge[];
  correction: { qubit: number; pauli: Pauli }[];
  logical: LogicalVerdict;
}

export interface TimelineSnapshot {
  round: number;
  phase: StepPhase;
  truth: PhysicalErrorLayer;               // layer 1
  measured: SyndromeLayer;                 // layer 2
}

export interface QecResult {
  layout: SurfaceCodeLayout;               // echoed by backend — FE/BE mismatch guard
  request: QecRequest;
  timeline: TimelineSnapshot[];            // 2*rounds + 1 (inject+measure per round, final decode step)
  inferred: DecoderInferenceLayer | null;  // layer 3 — one decode over the whole shot
}
```

`inferred` sits at result level rather than per-snapshot because MWPM decodes the whole detection history in one pass — there is no per-round guess to show, and pretending otherwise would misrepresent how decoding works. The final `decode` timeline step is where the UI reveals it.

**UI rule that follows:** each layer gets its own look on the lattice — its own colour, its own mark shape, its own legend entry, and its own toggle. Layers must also be told apart without colour (check in greyscale). A user must be able to switch layer 3 off and still see layers 1 and 2 unchanged. The lattice showing all three overlays mixed together is the main design risk in this build.

Key semantics (document in code):
- **`syndrome` is frame-corrected** (cumulative XOR of detection events). Raw first-round X-check outcomes are random (reference frame); detection events are the main quantity. Round 0 has detectors for Z checks only (deterministic vs |0⟩); X checks show `detectionEvents=0` at round 0 by definition.
- **Timeline steps**: per round `inject` then `measure`; one final `decode` step where matching/correction/verdict appear. The scrubber indexes this array.

### Stores — `frontend/src/lib/qec/stores.ts` (mirrors `IR/stores.ts` pattern)

```ts
export const qecResult = writable<QecResult | null>(null);
export const currentStep = writable<number>(0);
export const highlightedCheck = writable<string | null>(null);
export const visibleLayers = writable<{ truth: boolean; measured: boolean; inferred: boolean }>(...);
export const currentSnapshot = derived([qecResult, currentStep], ...);
```

Both panels are pure functions of `$currentSnapshot` + `$highlightedCheck` + `$visibleLayers` (+ `$qecResult.inferred` for the decode overlay). They never message each other — the same pattern as `$circuitIR`/`$simulationResult`.

### JSON contract

Response body **is** `QecResult`, camelCase (TS types are the contract; matches how `ir` is stored camelCase today). Matching edges reference `{round, checkId}`, never Stim's flat detector index — the backend owns that translation. Errors: 400 `{detail: string}`.

## 2. Backend design — `backend/qec/` app

Stateless — no models/migrations. Not the dormant `jobs` app (wrong name, model baggage, invites job-queue scope creep).

```
backend/qec/
  urls.py           # layout/, run/, error-rate/
  views.py          # APIView: permission_classes=[AllowAny], authentication_classes=[]
  serializers.py    # request validation: rounds 1–15; ≤20 errors; qubit 0–8; pauli X/Y/Z; round in [0, rounds); reject exact-duplicate triples
  layout.py         # D3_LAYOUT mirror (golden test pins FE/BE equality)
  experiment.py     # Stim circuit builder, one exact run, MWPM decode, error-rate sweep
  tests.py
  scripts/gen_fixtures.py   # not yet built (phase 2)
```

Dependencies are pinned in `backend/requirements.txt` (`stim==1.16.0`, `PyMatching==2.4.0`, `numpy==2.5.1`) and verified against Python 3.12. Scoped throttle `qec_run` on the view (scrubbing is client-side, so only config changes POST).

### Rule: only Stim produces syndromes

**No client-side syndrome math, ever.** The frontend never works out a detection event; it renders what the backend returns, and the backend returns what Stim sampled. There is no second implementation that could disagree. Cross-checking against an independent construction (Stim's own `surface_code:rotated_memory_z` generator) lives in the test suite (§4, golden 12), never in the product path.

### Stim circuit: hand-written (not the `surface_code:rotated_memory_z` generator)

Why: injections must be spliced at specific rounds (would need slicing the generated circuit anyway); hand-building lets us **choose** `DETECTOR(x, y, r)` = our exact check coords (no reverse-engineering Stim's convention); about 80 lines. Keep the generator as a cross-check in tests only.

Per round r (data 0–8, ancillas 9–16 in check-table order):
1. Injected Paulis for round r as literal X/Y/Z **gates** (not noise channels) — deterministic.
2. Stabilizer cycle: `R` ancillas; `H` X-ancillas; 4 CX layers in the standard zigzag schedule (X-checks ancilla→data, Z-checks data→ancilla — order matters even with no noise; the quiescent test catches mistakes); `H` X-ancillas; `M` ancillas.
3. Detectors: round 0 → Z checks only; rounds ≥1 → all 8 vs previous round. Every detector annotated `(check.x, check.y, r)`.
Final: `M` data; `OBSERVABLE_INCLUDE(0)` over data [0,1,2].

Sampling: `sim_circuit.compile_detector_sampler().sample(1, separate_observables=True)` → deterministic detection events + `observedFlip`.

### Decoding: reference DEM + PyMatching

The noiseless sim circuit has an empty DEM, so build a **reference circuit** (same builder, no injections) with phenomenological noise: `X_ERROR(p)`/`Z_ERROR(p)` on data before each cycle **and measurement-flip noise** (required — creates the time-like edges without which multi-round patterns cannot be matched), p=0.01 nominal. Then:

```python
dem = ref_circuit.detector_error_model(decompose_errors=True)  # needed so Y errors decompose
matching = pymatching.Matching.from_detector_error_model(dem)
prediction = matching.decode(detection_vector)                  # predictedFlip
edges = matching.decode_to_edges_array(detection_vector)        # -1 = boundary
```

Map edges to `MatchingEdge[]` via `get_detector_coordinates()` (assert sim/ref detector ordering identical). Correction inferred **geometrically** (unambiguous at d=3): same-round pair of checks → unique shared data qubit (Pauli X if Z-checks, Z if X-checks); boundary edge → the check's boundary qubit; time-like edge → no data correction (vertical wire-panel link). Fallback API: `decode_to_matched_dets_array`.

## 3. The scenario library — one artifact, two jobs

The canned scenarios are not throwaway scaffolding. **Each scenario is both a golden test and a product feature**, built once to serve both.

- *as test*: the fixture is the pinned expected output (§4).
- *as feature*: a permanent scenario picker in QEC mode — a learner steps through "corner error", "undetectable logical", "decoder failure" without having to know what to inject to see them.

Each scenario carries a short "what this shows" caption written for a learner, not a test name. The two that matter most are the ones where the tool shows its own limits: **undetectable logical** (zero detection events, logical flipped — layer 2 shows nothing, layer 1 shows everything) and **decoder failure** (MWPM completes the logical error, layer 3 is confidently wrong). A tool that can only show success would leave learners with a confident misunderstanding.

Fixtures live in `frontend/tests/qec/fixtures/`, are generated by `backend/qec/scripts/gen_fixtures.py`, and are regenerated — never hand-edited — so they cannot silently go out of date.

## Build order

- **Phase 1 — Static lattice.** ✅ `lib/qec/{schema,layout,stores}.ts`; `components/Qec/LatticePanel.svelte` (SVG 3×3 grid + 8 plaquettes from `D3_LAYOUT`; hover sets `highlightedCheck`). Vitest layout invariants (commutation via overlap parity; logicalZ even-overlaps all X checks).

- **Phase 2 — Scenario library on fixtures.**
  `gen_fixtures.py` (Stim only) emits `QecResult` JSONs for the scenario set → checked into `frontend/tests/qec/fixtures/` → scenario picker in QEC mode loads into `qecResult` → checks light up. Ship `lib/qec/validate.ts` (`validateQecResult()`, mirrors `IR/validate.ts`, no new deps) in this phase, since fixtures are what it guards.
  *Demo: pick a canned scenario, the correct checks fire, the caption explains what it shows.*

- **Phase 3 — Endpoint live + injection ledger.** ✅ `qec` app, builder, serializer, view; `qecApi.ts`. Injection UI with placement by clicking a data qubit on the lattice, and the **injected-error ledger**: a persistent, editable list of `(qubit, pauli, round)` that is the main display of layer 1 — visible while the lattice is lit and while matching is drawn, so ground truth never has to be worked out from the picture.

- **Phase 4 — Multi-round + wire panel + scrubber.**
  Rounds selector and step control ✅. Still to build: `WirePanel.svelte` (8 ancilla wires × rounds, 0/1 + detection marks), driven by the same `currentStep`, and cross-highlight via `highlightedCheck` (hovering a check in either panel highlights it in the other). Golden 9 (time-separated events). Decide whether to show the final data-measurement round.
  *Demo: scrub 5 rounds, events appear once, syndrome persists, and the round of an event can be read from its position.*

- **Phase 5 — Decode + matching viz + verdict.**
  Backend decode ✅, verdict text ✅. Still to build: matching lines + boundary stubs on the lattice as a **visually distinct third layer** with its own toggle (writes `visibleLayers`); correction overlay; `VerdictBanner.svelte`. Goldens 8, 10 and 12; decoder-failure and undetectable-logical UI states — including the copy that makes clear a correction is a guess, not the error. `validateQecResult()` run over all fixtures.
  *Demo: full scope, including the two cases where the decoder is wrong.*

- **Phase 6 — Polish and deploy.**
  Backend redeploy with new deps; Vercel env/CORS check; loading/error states; README. Fix the mobile gap (hide the QEC button on mobile, or give the panel a mobile layout).

Every phase ends demoable; nothing in phase N+1 blocks demoing phase N.

**Cut order if time runs short** (first cut first): visual polish and animation; scenario-library chrome beyond the picker itself; the optional final data-measurement detector layer; one of goldens 6/9. **Never cut**: the layer separation, or the two failure-mode scenarios. If Phase 5 is at risk, ship matching visualisation without the correction overlay.

**In-product honesty notes.** Every simplification that changes what the picture means is stated in the product, not only in docs. Current list (shown in `QecPanel.svelte`'s `SIMPLIFICATIONS`): d=3 only; errors you place always happen, no random noise; no gate or measurement errors in your run. Still to add as features land: phenomenological noise in the reference DEM rather than circuit-level; one decode pass over the whole shot; the logical qubit holds no user circuit.

## 4. Core vs stretch

**Core:** rotated d=3 memory-Z; deterministic (qubit, pauli, round) injections; multi-round syndrome + detection events; three separated layers; two synced panels + scrubber + hover-highlight; Stim truth + PyMatching MWPM; matching/correction/verdict; scenario library; validation against Stim.

**Unused backend capability:** `POST /qec/api/qec/error-rate/` (many-shot logical-error-rate sweep) has no UI. A small chart of logical error rate vs physical error rate would show *why* the code is worth having. Build only after phase 5.

**Stretch — gated on Phase 5 landing: circuit-level error injection in the editor (step 2 of the story above).**

Place a deterministic Pauli error at a (qubit, column) on the user's *own* circuit, re-run, and show ideal vs perturbed side by side. Cheap because it needs no new engine: `CircuitIR` is a flat op list keyed by `column`, so an injection is an inserted op and the existing statevector simulator runs it unchanged. It makes the whole tool hang together, rather than adding physics nobody asked for.

Error types, limited by what the existing simulator can represent:

| Tier | Error | Cost | In? |
|---|---|---|---|
| 1 | Deterministic Pauli X/Y/Z at (qubit, column) | insert an op, re-run | **yes** |
| 1 | Measurement bit-flip | flip a classical bit | **yes** |
| 1 | Coherent over-rotation — `RX(θ+ε)` for `RX(θ)` | change a parameter | **yes** |
| 2 | Stochastic depolarising noise | many shots + averaging | no |
| 3 | T1/T2 decoherence, amplitude damping | density matrices — new engine | **out** |

Tier 1 only. Its Pauli injection is the *same error model already used in QEC mode*: one consistent idea of "an error" across both halves is worth more than covering more error types badly. Coherent over-rotation earns its place despite being the odd one out — it costs nothing, it is the main error on real gate hardware, and it shows something the discrete-flip picture cannot.

**Out of scope for now:** distance-5; background/circuit-level noise models; ancilla gate animation; raw-syndrome vs detection-event toggle; "after correction" lattice view.

## 5. Validation (scientific correctness)

Backend goldens (`backend/qec/tests.py`), each asserting events + matching + verdict, each written in the phase noted:

| # | Case | Proves | Phase |
|---|---|---|---|
| 1 | Quiescent (5 rounds): all detectors 0, success | CX schedule is correct | 3 |
| 2 | X@q4@r1 → exactly Z0+Z1 at r1, paired, correction {q4:X}, success | basic spatial locality | 3 |
| 3 | X@q0@r0 (corner) → Z2 only, boundary match, success | boundary handling | 3 |
| 4 | Z@q4 → X0+X1, success | Z cannot flip logical Z | 3 |
| 5 | Y@q4 → Z0,Z1,X0,X1 all fire | guards `decompose_errors=True` | 3 |
| 6 | Two-error string (X@q1 + X@q4, same round) → events at string endpoints | error chains match at endpoints | 3 |
| 7 | Undetectable logical X@q0,q1,q2 → zero events, observedFlip=1, predictedFlip=0, **failure** | layer 1 ≠ layer 2 | 3 |
| 8 | Decoder failure (e.g. X@q0+X@q2): MWPM boundary-pairs, completes the logical → failure | layer 3 can be wrong | 5 |
| 9 | Multi-round X@q4@r1 + X@q1@r3 | time-like edges exist in the DEM | 4 |
| 10 | Endpoint timeline == raw `compile_detector_sampler()` bits reshaped | no corruption in transport | 5 |
| 11 | Determinism: identical request → byte-identical response | reproducibility | 3 |
| 12 | Hand-built circuit cross-checks against `surface_code:rotated_memory_z` | the construction itself, independently | 5 |

Note for golden 12: Stim's generator reports `num_qubits = 26` for d=3 — it indexes qubits by coordinate and leaves gaps, so that is the index space, not the qubit count. It is still 9 data + 8 ancilla. Its detector count at 3 rounds is 24, matching 4 (Z-only round 0) + 8 + 8 + 4 (final data layer).

Goldens 7 and 8 are the important pair: together they show that the tool tells apart *what happened*, *what was seen*, and *what was concluded* — including when those disagree.

Frontend (`frontend/tests/qec/`): layout invariants; `validateQecResult()` over every fixture; FE `D3_LAYOUT` deep-equals backend fixture `layout`; pure timeline-utility tests; a type-level test that a panel cannot read `inferred` through a `TimelineSnapshot`; the two honesty notes in `QecPanel.svelte` stay on screen.

## 6. Risks / unknowns

1. **First-round X-check randomness** — solved by the frame-corrected design; UI copy must not present ancilla values as raw measurements.
2. **Time-like edges** need measurement noise in the reference DEM (golden 9 guards).
3. **Y decomposition** needs `decompose_errors=True` (golden 5 guards).
4. **`decode_to_edges_array` version sensitivity** — PyMatching 2.4.0 has it; keep the pin at `>=2.1`; fallback documented.
5. **CX schedule ordering** — the quiescent test catches mistakes; use standard zigzag.
6. **Layers mixed up on the lattice** — the main *design* risk: three overlays on one SVG that a user cannot tell apart. Separate colour + shape + legend + per-layer toggles.
7. **Boundary-stub rendering** — stub toward nearest boundary; corners touch two, either is fine.
8. **Pairs vs paths** — draw straight lines between matched plaquettes (paths ≤ 2 at d=3).
9. **Deployment/throttle** — scoped `qec_run` throttle; backend host rebuild with new requirements; confirm CORS/`VITE_API_BASE_URL` reach `/qec/`.
10. **Sim vs reference detector-index mismatch** — same builder for both + `get_detector_coordinates()` assertion.

## Verification (end-to-end)

- Per phase: `cd frontend && npm run lint && npm run check && npx vitest run`; `cd backend && python manage.py test qec`. A phase is not complete until its goldens in §5 are green.
- Run Django locally (`python manage.py runserver`) + `npm run dev`, turn on QEC mode, inject X@q4 → check Z0+Z1 light up; compare a raw endpoint response against `compile_detector_sampler()` output in a shell.
- Phase 5: reproduce goldens 2/3/7/8 through the UI and confirm matching lines + verdict match the test expectations — in particular that 7 and 8 read clearly *as failures* to someone who did not write them.
- CI: `.github/workflows/test.yml` picks up backend deps automatically; confirm both jobs green.
