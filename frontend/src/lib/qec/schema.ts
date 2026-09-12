// Types for the rotated distance-3 surface code memory experiment.
//
// This file stands on its own: nothing here changes or uses CircuitIR. A QEC
// run is not a circuit the user built. It is a set of experiment settings (how
// many rounds, which errors), and the results come back from the backend.

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
	/** The qubits the logical Z operator acts on. How many there are is the code distance. */
	logicalZ: number[];
}

/** Added just BEFORE the stabiliser measurement of the given round. */
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

// ── The three layers of knowledge ──────────────────────────────────────────
// Kept as separate types, not mixed together as plain fields, so no panel can
// mix them up by accident. What was DONE to the qubits, what the ancillas SAW,
// and what the decoder GUESSED are three different kinds of information. A
// tool that shows them as one thing teaches the wrong idea.

/**
 * Layer 1: GROUND TRUTH. We only know this because the user placed the errors.
 * On a real quantum computer nobody can see this layer. Showing that difference
 * is the most important thing this visualisation has to do.
 */
export interface PhysicalErrorLayer {
	injected: InjectedError[];
}

/**
 * Layer 2: MEASURED. What the ancillas report. This is all that a real decoder
 * is ever allowed to see.
 */
export interface SyndromeLayer {
	/** checkId -> the check's current value (all detection events so far, XORed together). */
	syndrome: Record<string, 0 | 1>;
	/** checkId -> whether this check fired in this round. */
	detectionEvents: Record<string, 0 | 1>;
}

/**
 * Layer 3: INFERRED. The decoder's best guess. It agrees with layer 2, but it
 * is NOT layer 1 and may be different from it. A correction is a guess, never
 * "the error that really happened".
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
	/** Sent back by the backend, so if the frontend and backend layouts ever differ, a test fails. */
	layout: SurfaceCodeLayout;
	request: QecRequest;
	/** 2 * rounds + 1 steps: place + measure for each round, then one decode step. */
	timeline: TimelineSnapshot[];
	/**
	 * Layer 3 belongs to the whole result, not to each step. MWPM decodes the whole
	 * detection history in one go, so there is no separate guess for each round.
	 * Null until the decoder is added (Phase 5).
	 */
	inferred: DecoderInferenceLayer | null;
}
