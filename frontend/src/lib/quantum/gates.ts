import type { CanonicalUnitaryGate } from '$lib/IR/schema';
import { type Complex, createComplex } from './complex';

export interface QuantumGate {
	type: CanonicalUnitaryGate;
	matrix: Complex[][];
}

export const X_GATE: QuantumGate = {
	type: 'x',
	matrix: [
		[createComplex(0, 0), createComplex(1, 0)], // [0, 1]
		[createComplex(1, 0), createComplex(0, 0)] // [1, 0]
	]
};

export const Y_GATE: QuantumGate = {
	type: 'y',
	matrix: [
		[createComplex(0, 0), createComplex(0, -1)], // [0, -i]
		[createComplex(0, 1), createComplex(0, 0)] // [i, 0]
	]
};

export const Z_GATE: QuantumGate = {
	type: 'z',
	matrix: [
		[createComplex(1, 0), createComplex(0, 0)], // [1, 0]
		[createComplex(0, 0), createComplex(-1, 0)] // [0, -1]
	]
};

export const H_GATE: QuantumGate = {
	type: 'h',
	matrix: [
		[createComplex(1 / Math.sqrt(2), 0), createComplex(1 / Math.sqrt(2), 0)], // [1/sqrt(2), 1/sqrt(2)]
		[createComplex(1 / Math.sqrt(2), 0), createComplex(-1 / Math.sqrt(2), 0)] // [1/sqrt(2), -1/sqrt(2)]
	]
};

export const S_GATE: QuantumGate = {
	type: 's',
	matrix: [
		[createComplex(1, 0), createComplex(0, 0)], // [1, 0]
		[createComplex(0, 0), createComplex(0, 1)] // [0, i]
	]
};

export const T_GATE: QuantumGate = {
	type: 't',
	matrix: [
		[createComplex(1, 0), createComplex(0, 0)], // [1, 0]
		[createComplex(0, 0), createComplex(Math.cos(Math.PI / 4), Math.sin(Math.PI / 4))] // [0, e^(i pi/4)]
	]
};

export function createRXGate(theta: number): QuantumGate {
	const halfTheta = theta / 2;
	const cosHalf = Math.cos(halfTheta);
	const sinHalf = Math.sin(halfTheta);
	return {
		type: 'rx',
		matrix: [
			[createComplex(cosHalf, 0), createComplex(0, -sinHalf)], // [cos(θ/2), -i*sin(θ/2)]
			[createComplex(0, -sinHalf), createComplex(cosHalf, 0)] // [-i*sin(θ/2), cos(θ/2)]
		]
	};
}

export function createRYGate(theta: number): QuantumGate {
	const halfTheta = theta / 2;
	const cosHalf = Math.cos(halfTheta);
	const sinHalf = Math.sin(halfTheta);
	return {
		type: 'ry',
		matrix: [
			[createComplex(cosHalf, 0), createComplex(-sinHalf, 0)], // [cos(θ/2), -sin(θ/2)]
			[createComplex(sinHalf, 0), createComplex(cosHalf, 0)] // [sin(θ/2),  cos(θ/2)]
		]
	};
}

// Phase gate P(θ) = diag(1, e^{iθ}). Generalizes Z = P(π), S = P(π/2), T = P(π/4).
export function createPGate(theta: number): QuantumGate {
	return {
		type: 'p',
		matrix: [
			[createComplex(1, 0), createComplex(0, 0)],
			[createComplex(0, 0), createComplex(Math.cos(theta), Math.sin(theta))] // e^(i*theta)
		]
	};
}

export function createRZGate(theta: number): QuantumGate {
	const halfTheta = theta / 2;
	return {
		type: 'rz',
		matrix: [
			[createComplex(Math.cos(-halfTheta), Math.sin(-halfTheta)), createComplex(0, 0)], // e^(-i*theta/2)
			[createComplex(0, 0), createComplex(Math.cos(halfTheta), Math.sin(halfTheta))] // e^(i*theta/2)
		]
	};
}

// ─────────────────────────────────────────────────────────────
// Gate registry — single source of truth for gate identity.
//
// Every consumer (IR validator, gate palette, drag-drop, OpenQASM
// converter, and the backend manifest) should derive its gate list,
// parametric check, and QASM names from here instead of hard-coding
// its own copy. The matrix factory wraps the math above so this is
// the one place a new gate has to be declared.
// ─────────────────────────────────────────────────────────────

export interface GateSpec {
	id: CanonicalUnitaryGate;
	label: string; // palette display, e.g. "RX"
	category: 'pauli' | 'phase' | 'hadamard' | 'rotation' | 'multi';
	arity: number; // number of target qubits (swap = 2)
	numParams: number; // 0, or 1 for rotations
	qasmName: string; // base OpenQASM name
	controlledQasm?: Record<number, string>; // special controlled spellings, e.g. { 1: 'cx', 2: 'ccx' }
	matrix?: (params: number[]) => Complex[][]; // omitted for swap (simulator special-cases it)
	// Palette tooltip copy — `quick` is the bold title, `detail` the description.
	tooltip: { quick: string; detail: string };
}

export const GATE_REGISTRY: Record<CanonicalUnitaryGate, GateSpec> = {
	x: {
		id: 'x',
		label: 'X',
		category: 'pauli',
		arity: 1,
		numParams: 0,
		qasmName: 'x',
		controlledQasm: { 1: 'cx', 2: 'ccx' },
		matrix: () => X_GATE.matrix,
		tooltip: {
			quick: 'Pauli-X (NOT)',
			detail: 'Flips |0⟩ to |1⟩ and vice versa. The quantum equivalent of a classical NOT gate.'
		}
	},
	y: {
		id: 'y',
		label: 'Y',
		category: 'pauli',
		arity: 1,
		numParams: 0,
		qasmName: 'y',
		matrix: () => Y_GATE.matrix,
		tooltip: {
			quick: 'Pauli-Y',
			detail:
				'Flips the qubit and adds a phase of i. Rotates 180° around the Y-axis of the Bloch sphere.'
		}
	},
	z: {
		id: 'z',
		label: 'Z',
		category: 'pauli',
		arity: 1,
		numParams: 0,
		qasmName: 'z',
		controlledQasm: { 1: 'cz' },
		matrix: () => Z_GATE.matrix,
		tooltip: {
			quick: 'Pauli-Z',
			detail: 'Leaves |0⟩ unchanged, flips the phase of |1⟩. Rotates 180° around the Z-axis.'
		}
	},
	h: {
		id: 'h',
		label: 'H',
		category: 'hadamard',
		arity: 1,
		numParams: 0,
		qasmName: 'h',
		matrix: () => H_GATE.matrix,
		tooltip: {
			quick: 'Hadamard',
			detail:
				'Puts a qubit into equal superposition — a measurement gives |0⟩ or |1⟩ with 50/50 probability.'
		}
	},
	s: {
		id: 's',
		label: 'S',
		category: 'phase',
		arity: 1,
		numParams: 0,
		qasmName: 's',
		matrix: () => S_GATE.matrix,
		tooltip: { quick: 'S Gate (Phase)', detail: 'Adds a 90° phase shift to |1⟩. Equivalent to √Z.' }
	},
	t: {
		id: 't',
		label: 'T',
		category: 'phase',
		arity: 1,
		numParams: 0,
		qasmName: 't',
		matrix: () => T_GATE.matrix,
		tooltip: {
			quick: 'T Gate',
			detail: 'Adds a 45° phase shift to |1⟩. Used heavily in fault-tolerant quantum computing.'
		}
	},
	p: {
		id: 'p',
		label: 'P',
		category: 'phase',
		arity: 1,
		numParams: 1,
		qasmName: 'p',
		matrix: (p) => createPGate(p[0] ?? 0).matrix,
		tooltip: {
			quick: 'Phase P(θ)',
			detail:
				'Adds an arbitrary phase e^{iθ} to |1⟩. Generalizes Z, S, and T. Controlled-P is the building block of the Quantum Fourier Transform. Double-click to set the angle.'
		}
	},
	rx: {
		id: 'rx',
		label: 'RX',
		category: 'rotation',
		arity: 1,
		numParams: 1,
		qasmName: 'rx',
		matrix: (p) => createRXGate(p[0] ?? 0).matrix,
		tooltip: {
			quick: 'X-Rotation',
			detail:
				'Rotates the qubit around the X-axis by a chosen angle θ. Double-click to set the angle.'
		}
	},
	ry: {
		id: 'ry',
		label: 'RY',
		category: 'rotation',
		arity: 1,
		numParams: 1,
		qasmName: 'ry',
		matrix: (p) => createRYGate(p[0] ?? 0).matrix,
		tooltip: {
			quick: 'Y-Rotation',
			detail:
				'Rotates the qubit around the Y-axis by a chosen angle θ. Double-click to set the angle.'
		}
	},
	rz: {
		id: 'rz',
		label: 'RZ',
		category: 'rotation',
		arity: 1,
		numParams: 1,
		qasmName: 'rz',
		matrix: (p) => createRZGate(p[0] ?? 0).matrix,
		tooltip: {
			quick: 'Z-Rotation',
			detail:
				'Rotates the qubit around the Z-axis by a chosen angle θ. Double-click to set the angle.'
		}
	},
	swap: {
		id: 'swap',
		label: 'SWAP',
		category: 'multi',
		arity: 2,
		numParams: 0,
		qasmName: 'swap',
		tooltip: {
			quick: 'SWAP',
			detail: 'Exchanges the states of two qubits. Drop both ends on the same column.'
		}
	}
};

// Palette display category derived from the registry — keeps GatePalette from
// re-listing gates. Parametric gates get their own group; 2-target gates (swap)
// are 'two-qubit'; everything else is a plain single-qubit tile.
export type PaletteCategory = 'single' | 'parametric' | 'multi' | 'two-qubit';
export function paletteCategory(spec: GateSpec): PaletteCategory {
	if (spec.numParams > 0) return 'parametric';
	if (spec.arity >= 2) return 'two-qubit';
	return 'single';
}

// Derived lookups — use these instead of re-listing gate ids anywhere else.
export const UNITARY_GATE_IDS = Object.keys(GATE_REGISTRY) as CanonicalUnitaryGate[];
export const PARAMETRIC_GATE_IDS = UNITARY_GATE_IDS.filter((g) => GATE_REGISTRY[g].numParams > 0);

export function isGateId(value: string): value is CanonicalUnitaryGate {
	return value in GATE_REGISTRY;
}

export function isParametricGate(value: string): boolean {
	return isGateId(value) && GATE_REGISTRY[value].numParams > 0;
}

// Returns the special controlled OpenQASM name (e.g. cx, ccx, cz) or undefined
// if the gate uses the generic `ctrl @` form.
export function controlledQasmName(
	gate: CanonicalUnitaryGate,
	numControls: number
): string | undefined {
	return GATE_REGISTRY[gate].controlledQasm?.[numControls];
}
