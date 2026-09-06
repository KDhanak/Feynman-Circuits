// Types for the rotated distance-3 surface code memory experiment.
//
// Additive and self-contained: nothing here touches CircuitIR. A QEC run is
// not a circuit the user built, it is an experiment configuration (how many
// rounds, which errors) whose results come back from the backend.

export type Pauli = 'X' | 'Y' | 'Z';
export type CheckType = 'X' | 'Z';

export interface DataQubit {
	id: number;
	x: number;
	y: number;
}

/** One stabiliser generator, measured by one ancilla. */
export interface Check {
	id: string;
	type: CheckType;
	x: number;
	y: number;
	dataQubits: number[];
}

export interface SurfaceCodeLayout {
	distance: 3;
	dataQubits: DataQubit[];
	checks: Check[];
	/** Support of the logical Z operator. Its size is the code distance. */
	logicalZ: number[];
}

/** Applied BEFORE the given round's stabiliser measurement. */
export interface InjectedError {
	qubit: number;
	pauli: Pauli;
	round: number;
}

export interface QecRequest {
	rounds: number; // 1..15
	errors: InjectedError[]; // <= 20
}

export type StepPhase = 'inject' | 'measure' | 'decode';

export interface DetectorRef {
	round: number;
	checkId: string;
}

export type MatchingEdge =
	| { kind: 'pair'; a: DetectorRef; b: DetectorRef }
	| { kind: 'boundary'; a: DetectorRef };

export interface LogicalVerdict {
	observedFlip: 0 | 1;
	predictedFlip: 0 | 1;
	success: boolean;
}

// ── The three epistemic layers ──────────────────────────────────────────
// Kept as separate types rather than flat fields so that no panel can blur
// them by accident: what was DONE to the qubits, what the ancillas SAW, and
// what the decoder GUESSED are three different kinds of claim, and a tool
// that presents them as one teaches the wrong thing.

/**
 * Layer 1 — GROUND TRUTH. Known only because the user injected it. On real
 * hardware this layer is unobservable, and that asymmetry is the single most
 * important thing the visualisation has to convey.
 */
export interface PhysicalErrorLayer {
	injected: InjectedError[];
}

/**
 * Layer 2 — MEASURED. What the ancillas report, and everything a real decoder
 * is ever allowed to see.
 */
export interface SyndromeLayer {
	/** checkId -> frame-corrected value (cumulative XOR of detection events). */
	syndrome: Record<string, 0 | 1>;
	/** checkId -> whether this check fired in this round. */
	detectionEvents: Record<string, 0 | 1>;
}

/**
 * Layer 3 — INFERRED. The decoder's hypothesis. Consistent with layer 2, but
 * it is NOT layer 1 and may differ from it: a correction is a guess, never
 * "the error that happened".
 */
export interface DecoderInferenceLayer {
	matching: MatchingEdge[];
	correction: { qubit: number; pauli: Pauli }[];
	logical: LogicalVerdict;
}

export interface TimelineSnapshot {
	round: number;
	phase: StepPhase;
	truth: PhysicalErrorLayer;
	measured: SyndromeLayer;
}

export interface QecResult {
	/** Echoed by the backend so a FE/BE layout drift shows up as a test failure. */
	layout: SurfaceCodeLayout;
	request: QecRequest;
	/** 2 * rounds + 1 steps: inject + measure per round, then one decode step. */
	timeline: TimelineSnapshot[];
	/**
	 * Layer 3 sits at result level, not per-snapshot: MWPM decodes the whole
	 * detection history in one pass, so there is no per-round inference to show.
	 * Null until the decoder lands (Phase 5).
	 */
	inferred: DecoderInferenceLayer | null;
}
