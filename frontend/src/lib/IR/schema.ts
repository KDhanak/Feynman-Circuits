import { type BlochVector } from '../quantum/bloch';
import { type Complex } from '../quantum/complex';

export type CanonicalUnitaryGate =
	| 'x'
	| 'y'
	| 'z'
	| 'h'
	| 's'
	| 't'
	| 'p'
	| 'rx'
	| 'ry'
	| 'rz'
	| 'swap';

export type OperationKind = 'unitary' | 'measure' | 'reset' | 'barrier';

export interface BaseOperation {
	id: string;
	kind: OperationKind;
	gate: string;
	column: number;
}

export interface UnitaryOperation extends BaseOperation {
	kind: 'unitary';
	gate: CanonicalUnitaryGate;
	targets: number[];
	controls: number[];
	antiControls: number[];
	params: number[];
}

export interface MeasureOperation extends BaseOperation {
	kind: 'measure';
	targets: number[];
	classicalTargets: number[];
}

export interface ResetOperation extends BaseOperation {
	kind: 'reset';
	targets: number[];
}

export interface BarrierOperation extends BaseOperation {
	kind: 'barrier';
	targets: number[];
}

export type CircuitOperation =
	| UnitaryOperation
	| MeasureOperation
	| ResetOperation
	| BarrierOperation;

export interface CircuitIR {
	version: '1.0';
	registers: {
		q: number;
		c: number;
	};
	qubitLabels: string[];
	operations: CircuitOperation[];
	// Named stages of the circuit, e.g. "Oracle". Optional, so every circuit
	// made before zones existed is still valid as it is.
	zones?: CircuitZone[];
}

/**
 * A named part of the circuit: a range of columns, across every qubit. It is a
 * note for people reading the circuit and does not change the simulation.
 *
 * It holds columns, not gate ids, because share links give every gate a new
 * id. Zones never overlap, so each column belongs to at most one zone.
 */
export interface CircuitZone {
	id: string;
	name: string;
	startColumn: number;
	endColumn: number; // included, so a one-column zone has start === end
}

export interface SimulationResult {
	probabilities: { [state: string]: number };
	formattedState?: string;
	formattedQuantumStateApproximate?: string;
	formattedStatePolar?: string;
	blochVectors?: BlochVector[];
	measuredQubits?: number[];
	classicalBits?: Map<number, number>;
	// What happened in each column, for the step-by-step view. Recorded during
	// the same run as the results above, so a random measurement outcome shown
	// in the steps is the same one the results use.
	steps?: SimulationStep[];
}

// One column of the circuit, as the simulator ran it.
export interface SimulationStep {
	column: number;
	before: Complex[]; // state vector going into the column
	after: Complex[]; // state vector coming out of it
	ops: StepOperation[];
	measurements: StepMeasurement[];
	// The whole column as one matrix, so that after = matrix · before. Only kept
	// for small registers (a 3-qubit column is 8×8). It is null when the column
	// has a measurement, because a measurement is not a matrix multiplication.
	matrix: Complex[][] | null;
}

export interface StepOperation {
	op: UnitaryOperation;
	// The gate was not applied because its target had already been measured.
	skipped: boolean;
}

export interface StepMeasurement {
	qubit: number;
	prob0: number; // Born-rule chance of reading 0, before the collapse
	outcome: number;
}

export interface GateData {
	source: 'palette' | 'wire';
	gateType?: string;
	gateId?: string;
	isCopy?: boolean;
	qubit?: number;
}

export interface ErrorResponse {
	detail?: string;
}
