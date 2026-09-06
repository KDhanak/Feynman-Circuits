# QEC Visualization for Feynman Circuits — Rotated d=3 Surface Code Memory

## Context

Feynman Circuits (FC) is a quantum circuit visualization platform (SvelteKit frontend + Django backend). This plan adds a supervisor-approved, 12-week-scoped QEC feature: one rotated distance-3 surface code memory experiment (9 data qubits, 8 ancillas), user-injected deterministic Pauli errors at chosen (qubit, pauli, round), multi-round stabilizer measurements and detection events (syndrome[r] XOR syndrome[r−1]), Stim-generated syndromes, PyMatching MWPM decoding, matching/correction visualization, and a logical success/failure verdict — validated against Stim's raw output. Everything is **additive**: the existing CircuitIR, simulator, and editor are untouched.

Decisions locked: deterministic injections at user-chosen rounds (no background noise in core); compute in the existing Django backend via a new endpoint; new dedicated `/qec` frontend route.

**This plan serves PHY5005 Assessment 2.** Assessment 1 (proposal) scored 86/100 with one substantive criticism: the project must *"emphasize scientific correctness and formal evaluation alongside interface design."* The phase order below is rebalanced against that — see §0.

## 0. Objectives → phases (the rebalance)

The proposal states five objectives. An earlier draft of this plan scheduled only two of them; that imbalance *was* the marker's criticism, expressed as a schedule. Every objective now owns weeks.

| # | Proposal objective | Phase(s) | Weeks |
|---|---|---|---|
| 1 | Characterise the comprehension barrier; produce explicit design criteria | Phase 0 | 1 |
| 2 | Multi-panel linked-timeline visualisation (composition follows from Obj 1) | Phases 1, 4, 5 | 2, 7–10 |
| 3 | Deterministic error injection | Phase 3 | 5–6 |
| 4 | Evaluate the module against those criteria | Phase 6 | 11 |
| 5 | Assess extensibility | Phase 6 | 11 |

Two standing rules that follow from the marker feedback:

- **Validation is not a phase.** The golden battery (§6) is written *inside* the phase that creates the behaviour it pins, not deferred to a cleanup week. A phase is not done until its goldens are green.
- **Phase 6 is protected.** If the schedule slips, polish and deploy chrome absorb it (§4 cut order). Evaluation does not slip — scheduling it last was the original failure mode, and shipping an unevaluated tool is the one outcome that cannot be argued around in the report.

### The motivating arc (report framing, not build scope)

This module is the third act of a three-stage arc, and the report should say so, because the arc is what makes Objective 1's answer defensible:

1. **Build** — the circuit does what you intended. *(exists today on `/`)*
2. **Perturb** — inject an error, watch the distribution degrade. Teaches **what errors do**: the problem. *(not built — see §5)*
3. **Protect** — errors are detected and corrected without ever measuring the data. Teaches **how the field fights back**: the solution. *(this plan)*

Stage 3 currently arrives without stage 2, which means the tool presents a solution to a problem the user has never watched fail.

**This sharpens Objective 1.** The proposal's stated premise is that the barrier is **representational** — QEC is spatial and temporal at once, and static media cannot show a coupled object. The arc names a second, complementary barrier: learners meet QEC as the answer to a failure they have never seen happen. Objective 1 should report both, with the representational claim carrying the citations it already has (Ainsworth; the spatio-temporal structure argument) and the motivational one stated as a secondary finding that still needs support — leading with an uncited claim would move backwards on the Assessment 1 criticism. Characterising the barrier is what Objective 1 is *for*, so finding that it has two components is a result, not a scope change.

**The seam, stated honestly.** Stages 2 and 3 do not compose computationally. Stage 2 would be up to 8 unencoded qubits on the dense statevector simulator; stage 3 is 17 physical qubits on a stabiliser simulator, holding one logical qubit that does nothing. They share a narrative and an error model — deterministic Pauli injection — and they are **not** an end-to-end fault-tolerant pipeline. A user who came away thinking "I built a circuit and the surface code protected it" would have learned something false, which is exactly the ethical risk the proposal names. Both the UI copy and the report have to foreclose that reading.

## Verified existing architecture

- **Truth/IR layer** (`frontend/src/lib/IR/`): `schema.ts` (`CircuitIR` = flat op list keyed by `column`), `stores.ts` (writable stores `circuitIR`, `simulationResult`), `operations.ts` (mutators), `validate.ts`. Pure math in `frontend/src/lib/quantum/`. Hand-written dense statevector simulator `frontend/src/lib/circuit/simulator.ts`, capped at 8 qubits (`MAX_QUBITS` in `lib/utils/constants.ts`; d=3 needs 17 → another reason Stim does the QEC simulation).
- **UI boundary confirmed**: `frontend/src/lib/` has no Svelte components/DOM logic; UI lives in `frontend/src/components/` + `frontend/src/routes/`, consuming stores via `$store` auto-subscription. The lib layer's only Svelte dependency is `svelte/store` as state transport.
- **Svelte 5 in legacy style** (writable stores + `export let` props, not runes). Follow that style.
- **Backend is Django + DRF** (`backend/`, apps `accounts`, `circuits`; dormant `jobs` not in `INSTALLED_APPS`). Frontend calls it via axios (`frontend/src/lib/api/axios.ts`, `circuitApi.ts`). DRF defaults: `CookieJWTAuthentication` + `AnonRateThrottle` "anon": "100/hour" (`backend/config/settings.py:159-171`). `AllowAny` precedent exists in `backend/accounts/views.py`.
- **No existing concept** of ancillas/roles, stabilizers, rounds, or timelines — the QEC structures below are new, isolated in `frontend/src/lib/qec/` + `backend/qec/`.
- Tests: frontend Vitest (`frontend/tests/`, golden style per `tests/circuit/simulator.golden.test.ts`); backend `manage.py test`; CI `.github/workflows/test.yml` installs `backend/requirements.txt` (Python 3.12/linux) so new deps flow into CI automatically.

### The existing editor's panels are not candidates for reuse

`/qec` is a new route with an empty panel budget. `CircuitDataPanel`, `SimulationResult` and `OverallBlochSphere` stay on `/` untouched, and none is portable here: the first serializes a `CircuitIR` that a QEC run does not have, and the latter two read `$simulationResult` — a statevector that does not exist on this path and could not be produced anyway at 17 qubits against `MAX_QUBITS = 8`. Rendering an averaged Bloch vector over an encoded 17-qubit state would be the exact failure the proposal names as its main ethical risk ("a tool that makes QEC feel comprehensible while concealing what it simplified"). Recorded here because the question recurs.

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
export interface DetectorRef { round: number; checkId: string; }
export type MatchingEdge =
  | { kind: 'pair'; a: DetectorRef; b: DetectorRef }
  | { kind: 'boundary'; a: DetectorRef };
export interface LogicalVerdict { observedFlip: 0 | 1; predictedFlip: 0 | 1; success: boolean; }
```

### The three epistemic layers — typed apart, not just drawn apart

Assessment 1 feedback requires that the implementation *"clearly differentiate physical errors, extracted syndromes, and decoder inferences."* That is a correctness property, not a rendering choice, so it is enforced in the types: three named layers that no panel can conflate by accident, because conflating them would not typecheck.

```ts
/** Layer 1 — GROUND TRUTH. Known only because the user injected it.
 *  On real hardware this layer is unobservable; that asymmetry is the
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

/** Layer 3 — INFERRED. The decoder's hypothesis. It is consistent with
 *  layer 2 but is NOT layer 1 and may differ from it — the tool must never
 *  present a correction as "the error that happened". */
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
  layout: SurfaceCodeLayout;               // echoed by backend — FE/BE drift guard
  request: QecRequest;
  timeline: TimelineSnapshot[];            // 2*rounds + 1 (inject+measure per round, final decode step)
  inferred: DecoderInferenceLayer | null;  // layer 3 — one decode over the whole shot; null until Phase 5
}
```

`inferred` sits at result level rather than per-snapshot because MWPM decodes the entire detection history in one pass — there is no per-round inference to show, and pretending otherwise would misrepresent how decoding works. The final `decode` timeline step is where the UI reveals it.

**UI rule that follows:** each layer gets its own visual channel on the lattice — distinct colour, distinct mark shape, its own legend entry, and its own toggle. A user must be able to switch layer 3 off and still see layers 1 and 2 unchanged. The lattice carrying all three overlays undifferentiated is the main design risk in this build.

Key semantics (document in code):
- **`syndrome` is frame-corrected** (cumulative XOR of detection events). Raw first-round X-check outcomes are nondeterministic (reference frame); detection events are the primary quantity. Round 0 has detectors for Z checks only (deterministic vs |0⟩); X checks show `detectionEvents=0` at round 0 by definition.
- **Timeline steps**: per round `inject` then `measure`; one final `decode` step where matching/correction/verdict appear. Scrubber indexes this array.

### Stores — `frontend/src/lib/qec/stores.ts` (mirrors `IR/stores.ts` pattern)

```ts
export const qecResult = writable<QecResult | null>(null);
export const currentStep = writable<number>(0);
export const highlightedCheck = writable<string | null>(null);
export const visibleLayers = writable<{ truth: boolean; measured: boolean; inferred: boolean }>(...);
export const currentSnapshot = derived([qecResult, currentStep], ...);
```

Both panels are pure functions of `$currentSnapshot` + `$highlightedCheck` + `$visibleLayers` (+ `$qecResult.inferred` for the decode overlay). They never message each other — same consumption pattern as `$circuitIR`/`$simulationResult`. This mirroring is deliberate and is the evidence base for Objective 5 (§7).

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

Wire-up: add `"qec"` to `INSTALLED_APPS`; `path("qec/", include("qec.urls"))` in `backend/config/urls.py`. Dependencies are already pinned in `backend/requirements.txt` (`stim==1.16.0`, `PyMatching==2.4.0`, `numpy==2.5.1`) and verified against the venv's Python 3.12.0 — see §8.1. Add scoped throttle `"qec": "600/hour"` on the view (default anon 100/hour is tight for live demos; scrubbing is client-side so only config changes POST).

### Methodological principle: Stim is the sole source of syndrome truth

**No client-side syndrome math, ever.** The frontend never derives a detection event; it renders what the backend returns, and the backend returns what Stim sampled. This is the project's primary correctness claim and it is cheap to defend precisely because it admits no middle ground — there is no second implementation to drift. Cross-validation against an independent construction (Stim's own `surface_code:rotated_memory_z` generator) lives in the test suite (§6, golden 12), never in the product path.

### Stim circuit: hand-written (not the `surface_code:rotated_memory_z` generator)

Rationale: injections must be spliced at specific rounds (would require slicing the generated circuit anyway); hand-building lets us **choose** `DETECTOR(x, y, r)` = our exact check coords (no reverse-engineering stim's convention); ~80 lines and pedagogically valuable for the report. Keep the generator as a cross-check in tests only.

Per round r (data 0–8, ancillas 9–16 in check-table order):
1. Injected Paulis for round r as literal X/Y/Z **gates** (not noise channels) — deterministic.
2. Stabilizer cycle: `R` ancillas; `H` X-ancillas; 4 CX layers in the standard zigzag schedule (X-checks ancilla→data, Z-checks data→ancilla — order matters even noiselessly; quiescent test is the tripwire); `H` X-ancillas; `M` ancillas.
3. Detectors: round 0 → Z checks only; rounds ≥1 → all 8 vs previous round. Every detector annotated `(check.x, check.y, r)`.
Final: `M` data; `OBSERVABLE_INCLUDE(0)` over data [0,1,2]. (Optional final data-measurement detector layer — decide in Phase 4.)

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

## 3. The scenario library — one artifact, three jobs

The canned scenarios are not a development scaffold to be thrown away after Phase 2. **Each scenario is simultaneously a golden test, a product feature, and an evaluation instrument**, and building it once to serve all three is the highest-leverage decision in this plan.

- *as test*: the fixture is the pinned expected output (§6).
- *as feature*: a permanent scenario picker on `/qec` — a learner steps through "corner error", "undetectable logical", "decoder failure" without having to know what to inject to see them.
- *as evaluation*: the fixed task set used in Phase 6, so evaluation runs against reproducible states rather than whatever the evaluator happened to click.

Each scenario carries a short "what this shows" caption written for a learner, not a test name. The two that matter most pedagogically are the ones where the tool tells on itself: **undetectable logical** (zero detection events, logical flipped — layer 2 shows nothing, layer 1 shows everything) and **decoder failure** (MWPM completes the logical error, layer 3 is confidently wrong). A tool that can only show success would be exactly the "confident misunderstanding" risk the proposal names.

Fixtures live in `frontend/tests/qec/fixtures/`, are generated by `backend/qec/scripts/gen_fixtures.py`, and are regenerated — never hand-edited — so they cannot silently go stale.

## 4. Phased build order (12 weeks)

- **Phase 0 (wk 1) — Design criteria + comparative analysis. [Objective 1]**
  Install and work the *same* d=3 scenario through Crumble, Quirk and IBM Quantum Composer; record per tool what each representation makes visible, what it assumes the user already knows, and what it costs to read. Produce (a) the structured tool-comparison table the Assessment 1 feedback asked for, and (b) an explicit, numbered set of design criteria, framed in Ainsworth's DeFT terms, from which panel composition is then *derived* rather than assumed. Output is a committed document (`docs/qec-design-criteria.md`), not notes — Phase 1 cites it.
  The dependency risk is already closed (§8.1), so the only other week-1 item is the asynchronous one: **email the institutional ethics office for current turnaround** (§7 — it silently determines which evaluation method is available in week 11). Send it on day 1; that answer arrives on someone else's schedule, not yours.
  *Deliverable: design criteria doc + tool comparison table — both go into the report almost verbatim.*

- **Phase 1 (wk 2) — Static lattice. [Objective 2]**
  `lib/qec/{schema,layout,stores}.ts`; route `frontend/src/routes/qec/+page.svelte`; `frontend/src/components/Qec/LatticePanel.svelte` (SVG 3×3 grid + 8 plaquettes from `D3_LAYOUT`; hover sets `highlightedCheck`). Layer channels and legend stubbed in from the start, even with only layer 1 to show. Vitest layout invariants (commutation via overlap parity; logicalZ even-overlaps all X checks).
  *Demo: the lattice, correct and legible, with each panel traceable to a numbered criterion from Phase 0.*

- **Phase 2 (wks 3–4) — Scenario library on fixtures.**
  `gen_fixtures.py` (stim only) emits `QecResult` JSONs (timeline only) for the scenario set → checked into `frontend/tests/qec/fixtures/` → scenario picker on `/qec` loads into `qecResult` → checks light up. Ship `lib/qec/validate.ts` (`validateQecResult()`, mirrors `IR/validate.ts`, no new deps) and the FE/BE layout drift test in this phase, since fixtures are what they guard.
  *Demo: pick a canned scenario, correct checks fire, caption explains what it shows.*

- **Phase 3 (wks 5–6) — Endpoint live + injection ledger. [Objective 3]**
  `qec` app, builder, timeline, serializer, view (`inferred: null`); `qecApi.ts`. Injection UI as a `GatePalette`-style top strip (Pauli + round + rounds count + Run), with placement by clicking a data qubit on the lattice. The strip includes the **injected-error ledger**: a persistent, editable list of `(qubit, pauli, round)` that is the authoritative rendering of layer 1 — visible while the lattice is lit and while matching is drawn, so ground truth never has to be reconstructed from the picture. Backend goldens 1–7 and 11 + determinism test written here; CI green with new deps.
  *Demo: arbitrary injections, live, with truth and measurement side by side and distinguishable.*

- **Phase 4 (wks 7–8) — Multi-round + wire panel + scrubber. [Objective 2]**
  Rounds selector; `StepScrubber.svelte` → `currentStep`; `WirePanel.svelte` (8 ancilla wires × rounds, 0/1 + detection marks); cross-highlight via `highlightedCheck`. Golden 9 (time-separated events) written here. Decide final-measurement-round display.
  *Demo: scrub 5 rounds, events appear once, syndrome persists.*

- **Phase 5 (wks 9–10) — Decode + matching viz + verdict. [Objective 2]**
  `decode.py`; populate `inferred`; matching lines + boundary stubs on the lattice as a **visually distinct third layer** with its own toggle; correction overlay; `VerdictBanner.svelte`. Goldens 8, 10 and 12; decoder-failure and undetectable-logical UI states — including the copy that makes clear a correction is a hypothesis, not the error. `validateQecResult()` run over all fixtures.
  *Demo: full supervisor-approved scope, including the two cases where the decoder is wrong.*

- **Phase 6 (wk 11) — Evaluation + extensibility. [Objectives 4 and 5]**
  Run the evaluation defined in §7 against the Phase 0 criteria, using the scenario library as the fixed task set. Write up results, including criteria the build failed to meet — a clean sweep would be evidence the criteria were toothless. Then the extensibility assessment (§7): what the architecture actually supports beyond d=3, argued from the mirrored-store evidence rather than asserted.
  *Deliverable: the evaluation chapter, drafted.*

- **Phase 7 (wk 12) — Polish, deploy, write-up, slack.**
  Backend redeploy with new deps; Vercel env/CORS check; nav link; loading/error states; README. Remaining slack.

Every phase ends demoable; nothing in phase N+1 blocks demoing phase N.

**Cut order if the schedule slips** (first cut first): visual polish and animation; scenario-library chrome beyond the picker itself; the optional final data-measurement detector layer; one of goldens 6/9. **Never cut**: Phase 0 (everything downstream cites it), Phase 6, the layer separation, or the two failure-mode scenarios. If Phase 5 is at risk, ship matching visualisation without the correction overlay rather than deferring evaluation.

## 5. Core vs stretch

**Core:** rotated d=3 memory-Z; deterministic (qubit, pauli, round) injections; multi-round syndrome + detection events; three separated layers; two synced panels + scrubber + hover-highlight; Stim truth + PyMatching MWPM; matching/correction/verdict; scenario library; validation vs stim; evaluation against stated criteria.

**Stretch — one named item, gated on Phase 5 landing on time: circuit-level error injection on `/` (stage 2 of the arc, §0).**

Place a deterministic Pauli error at a (qubit, column) on the user's *own* circuit, re-run, and show ideal vs perturbed side by side. Cheap because it needs no new engine: `CircuitIR` is a flat op list keyed by `column`, so an injection is an inserted op and the existing statevector simulator runs it unchanged. It is the better stretch precisely because it makes the whole tool cohere, rather than adding physics nobody asked for.

Error types, bounded by what the existing simulator can actually represent:

| Tier | Error | Cost | In? |
|---|---|---|---|
| 1 | Deterministic Pauli X/Y/Z at (qubit, column) | insert an op, re-run | **yes** |
| 1 | Measurement bit-flip | flip a classical bit | **yes** |
| 1 | Coherent over-rotation — `RX(θ+ε)` for `RX(θ)` | perturb a parameter | **yes** |
| 2 | Stochastic depolarising noise | many shots + averaging | no |
| 3 | T1/T2 decoherence, amplitude damping | density matrices — new engine | **out** |

Tier 1 only. Note that its Pauli injection is the *same error model already locked for `/qec`*: one consistent notion of "an error" across both halves of the arc is worth more pedagogically than covering more error types badly. Coherent over-rotation earns its place despite being the odd one out — it costs nothing, it dominates real gate hardware, and it makes a point the discrete-flip picture cannot.

This sits **outside the Assessment 1 scope as written** and should be raised with the supervisor before it is built, not after.

**Demoted to report discussion only** (previously listed as stretch candidates): distance-5; background/circuit-level noise models; explicit ancilla gate animation; raw-syndrome vs detection-event toggle; final-round data-measurement column; "after correction" lattice view. Assessment 1 credited this project's scope discipline; these add physics nobody asked for.

## 6. Validation strategy (scientific correctness)

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
| 8 | Decoder failure (e.g. X@q0+X@q2): MWPM boundary-pairs, completes the logical → failure | layer 3 can be wrong (pin exact expectation from tool output when writing) | 5 |
| 9 | Multi-round X@q4@r1 + X@q1@r3 | time-like edges exist in the DEM | 4 |
| 10 | Endpoint timeline == raw `compile_detector_sampler()` bits reshaped | no transport corruption | 5 |
| 11 | Determinism: identical request → byte-identical response | reproducibility | 3 |
| 12 | Hand-built circuit cross-checks against `surface_code:rotated_memory_z` | the construction itself, independently | 5 |

Note for golden 12: stim's generator reports `num_qubits = 26` for d=3 — it indexes qubits by coordinate and leaves gaps, so that is the index space, not the qubit count. It is still 9 data + 8 ancilla. Its detector count at 3 rounds is 24, matching 4 (Z-only round 0) + 8 + 8 + 4 (final data layer).

Goldens 7 and 8 are the scientifically important pair: together they establish that the tool distinguishes *what happened*, *what was seen*, and *what was concluded* — including when those disagree.

Frontend (`frontend/tests/qec/`): layout invariants; `validateQecResult()` over every fixture; FE `D3_LAYOUT` deep-equals backend fixture `layout` (drift guard); pure timeline-utility tests; a type-level test that a panel cannot read `inferred` through a `TimelineSnapshot`.

## 7. Evaluation and extensibility (Objectives 4 and 5)

### Evaluation method — decide in week 1, not week 11

**Primary (recommended, no external dependency): analytical evaluation.** A structured walkthrough of the Phase 0 criteria against the built module, plus a task-based representational comparison: define specific comprehension and verification tasks — *"given this detection-event pattern across rounds, which qubit failed and when?"*, *"did the decoder get it right, and how would you know?"* — and analyse what each tool (this module, Crumble, a static textbook figure) affords for each. Evidence is the analysis itself; nothing is gated on other people's calendars.

**Optional (only if ethics clears early): small-n user study.** Stronger evidence, but almost certainly requires institutional ethics approval. Establish that turnaround in Phase 0 — if it exceeds ~4 weeks it cannot fit, and the decision should be made once, early, rather than discovered in week 10.

Criteria must be *measurable* as written in Phase 0 (Assessment 1 feedback), which means each one states what would count as failing it. Report the criteria the build fails.

### Extensibility — the claim, and its honest limit

Objective 5 needs care, because this plan's chief engineering virtue works against it: QEC is fully additive and shares almost no code with the circuit pipeline. A reader can fairly ask what the platform contributed beyond hosting.

The defensible claim is that it contributed an **architectural pattern**, not code: a canonical truth layer, transported by stores, consumed by panels that are pure functions of a snapshot and never message each other. `lib/qec/stores.ts` mirrors `lib/IR/stores.ts`; `LatticePanel`/`WirePanel` consume `$currentSnapshot` exactly as `SimulationResult`/`OverallBlochSphere` consume `$simulationResult`; a second domain was added without touching the first. That is evidence, and it is already true by construction — but only if argued deliberately. State the limit too: the shared surface is a pattern and a UI shell, not a shared engine, and a third domain would re-derive its own truth layer again.

## 8. Risks / unknowns

1. ~~**stim/pymatching Windows wheels**~~ — **CLOSED (pre-Phase 0).** Verified on `backend/venv` Python 3.12.0: `stim 1.16.0`, `PyMatching 2.4.0`, `numpy 2.5.1` all import cleanly, and `detector_error_model(decompose_errors=True)` round-trips on the generated d=3 circuit. CI 3.12/linux is fine.
2. **Ethics approval turnaround** determines whether a user study is possible at all — establish in Phase 0, decide once.
3. **First-round X-check nondeterminism** — solved by frame-corrected design; UI copy must not present ancilla values as raw measurements.
4. **Time-like edges** require measurement noise in the reference DEM (golden 9 guards).
5. **Y decomposition** requires `decompose_errors=True` (golden 5 guards).
6. ~~**`decode_to_edges_array` version sensitivity**~~ — **CLOSED (pre-Phase 0).** PyMatching 2.4.0 exposes `decode_to_edges_array`, `decode_to_matched_dets_array` and `from_detector_error_model`. Keep the pin at `>=2.1` so the constraint stays expressed; fallback documented.
7. **CX schedule ordering** — quiescent test is the tripwire; use standard zigzag.
8. **Layer conflation on the lattice** — the main *design* risk: three overlays on one SVG that a user cannot tell apart. Distinct channels + legend + per-layer toggles, tested in the Phase 6 walkthrough.
9. **Boundary-stub rendering** — stub toward nearest boundary; corners touch two, either acceptable.
10. **Pairs vs paths** — render straight lines between matched plaquettes (paths ≤ 2 at d=3).
11. **Deployment/throttle** — scoped `"qec"` throttle; backend host rebuild with new requirements; confirm CORS/`VITE_API_BASE_URL` reach `/qec/`.
12. **Sim vs reference detector-index drift** — same builder for both + `get_detector_coordinates()` assertion.

## Verification (end-to-end)

- Per phase: `cd frontend && npm run lint && npm run check && npx vitest run`; `cd backend && python manage.py test qec`. A phase is not complete until the goldens assigned to it in §6 are green.
- Phase 3+: run Django locally (`python manage.py runserver`) + `npm run dev`, open `/qec`, inject X@q4 → verify Z0+Z1 light up; compare a raw endpoint response against `compile_detector_sampler()` output in a shell.
- Phase 5: reproduce goldens 2/3/7/8 through the UI and confirm matching lines + verdict match the test expectations — in particular that 7 and 8 are legible *as failures* to someone who did not write them.
- Phase 6: every numbered Phase 0 criterion has a recorded pass/fail with justification.
- CI: `.github/workflows/test.yml` picks up backend deps automatically; confirm both jobs green.
