import type { CircuitIR, UnitaryOperation } from "../IR/schema";
import { circuitIR } from "../IR/stores";
import type { SimulationResult } from "../IR/schema";
import { simulationResult } from "../IR/stores";
import { createComplex, formatQuantumState, formatQuantumStatePolar, magnitudeSquared, scale, type Complex } from "../quantum/complex";
import { type QuantumState, createState } from "../quantum/vector";
import { applyMatrix, extendGateMatrix, computeMultiControlledUMatrix, computeMultiControlledUMatrixWithAntiControls } from "../quantum/matrix";
import { GATE_MAP, createRXGate, createRYGate, createRZGate } from "../quantum/gates";
import { get } from "svelte/store";
import { computeBlochVectorsFromState } from '../quantum/bloch';
import { markAsReset } from './autoSave';


/**
 * Collapses ONE qubit to a random 0 or 1 (according to Born's rule).
 * This is how every quantum simulator (Quirk, IBM, Qiskit) does it.
 */
export function collapseQubit(
	state: QuantumState,
	qubit: number,
	numQubits: number
): { newState: QuantumState; outcome: number } {
	const dim = 1 << numQubits;
	// Little-endian (Qiskit/OpenQASM) convention: qubit q maps directly to
	// statevector bit position q (q0 = least-significant bit / rightmost label).
	const pos = qubit;

	let prob0 = 0;
	const blockSize = 1 << pos;

	for (let base = 0; base < dim; base += 2 * blockSize) {
		for (let offset = 0; offset < blockSize; offset++) {
			prob0 += magnitudeSquared(state[base + offset]);
		}
	}

	const outcome = Math.random() < prob0 ? 0 : 1;

	const newState = state.map((amp, index) => {
		const bit = (index >> pos) & 1;
		return bit === outcome ? amp : createComplex(0, 0);
	});

	const totalProb = newState.reduce((sum, amp) => sum + magnitudeSquared(amp), 0);
	const norm = Math.sqrt(totalProb || 1);

	return {
		newState: newState.map(amp => scale(amp, 1 / norm)),
		outcome
	};
}

/**
 * Builds the full-system matrix for a single unitary op, applying any controls/anti-controls.
 * `swap` is handled directly on the state (it isn't matrix-based), so it is not covered here.
 * Returns null for an unknown gate so the caller can skip it.
 */
function getGateMatrix(op: UnitaryOperation, numQubits: number): Complex[][] | null {
	let baseMatrix: Complex[][];

	switch (op.gate) {
		case 'rx':
			baseMatrix = createRXGate(op.params[0] ?? 0).matrix;
			break;
		case 'ry':
			baseMatrix = createRYGate(op.params[0] ?? 0).matrix;
			break;
		case 'rz':
			baseMatrix = createRZGate(op.params[0] ?? 0).matrix;
			break;
		default: {
			const gateDef = GATE_MAP[op.gate];
			if (!gateDef) return null;
			baseMatrix = gateDef.matrix;
		}
	}

	if (op.controls.length === 0 && op.antiControls.length === 0) {
		return extendGateMatrix(baseMatrix, op.targets[0], numQubits);
	} else if (op.antiControls.length === 0) {
		return computeMultiControlledUMatrix(op.controls, op.targets[0], numQubits, baseMatrix);
	} else {
		return computeMultiControlledUMatrixWithAntiControls(op.controls, op.antiControls, op.targets[0], numQubits, baseMatrix);
	}
}

// ─────────────────────────────────────────────────────────────
// Unified simulator (works for 1 qubit AND multi-qubit)
// ─────────────────────────────────────────────────────────────
export function simulateMultipleQubits(ir: CircuitIR): SimulationResult {
	const numQubits = ir.registers.q;
	if (numQubits < 1) throw new Error('At least 1 qubit required');

	const dim = 1 << numQubits;
	let state: QuantumState = createState(Array(dim).fill(null).map(() => createComplex(0, 0)));
	state[0] = createComplex(1, 0);

	const measuredQubits = new Set<number>();
	const classicalBits = new Map<number, number>();

	const maxColumn = ir.operations.length ? Math.max(...ir.operations.map(op => op.column)) + 1 : 0;

	for (let colIndex = 0; colIndex < maxColumn; colIndex++) {
		const colOps = ir.operations.filter(op => op.column === colIndex);

		for (const op of colOps) {
			if (op.kind === 'measure') {
				for (const target of op.targets) {
					measuredQubits.add(target);
					const result = collapseQubit(state, target, numQubits);
					state = result.newState;
					classicalBits.set(target, result.outcome);
				}
				continue;
			};

			if (op.kind === 'reset' || op.kind === 'barrier')
				continue;

			if (op.kind === 'unitary') {
				if (measuredQubits.has(op.targets[0])) continue; // skip gates on measured qubits

				let matrix: Complex[][] | null;

				if (op.gate === 'swap') {
					if (op.targets.length !== 2) continue;
					const [q1, q2] = op.targets;
					const p1 = q1;
					const p2 = q2;
					const swapped = [...state];
					for (let i = 0; i < dim; i++) {
						const b1 = (i >> p1) & 1;
						const b2 = (i >> p2) & 1;
						if (b1 !== b2) {
							const j = i ^ (1 << p1) ^ (1 << p2);
							if (i < j) { [swapped[i], swapped[j]] = [swapped[j], swapped[i]]; }
						}
					}
					state = swapped;
					continue;
				} else {
					matrix = getGateMatrix(op, numQubits);
					if (!matrix) continue; // unknown or unsupported gate
				}

				state = applyMatrix(matrix, state);
			}
		}
	}

	const probabilities = Object.fromEntries(
		state.map((amplitude, idx) => {
			const bitString = idx.toString(2).padStart(numQubits, '0');
			const prob = magnitudeSquared(amplitude);
			return [bitString, prob] as [string, number];
		})
	);

	const formattedState = formatQuantumState(state);
	const formattedStatePolar = formatQuantumStatePolar(state);
	const blochVectors = computeBlochVectorsFromState(state, numQubits);

	return {
		probabilities,
		formattedState,
		formattedStatePolar,
		blochVectors,
		measuredQubits: Array.from(measuredQubits).sort((a, b) => a - b),
		classicalBits
	};
}

export function resetCircuit() {
	const current = get(circuitIR);
	const qubits = current.registers.q || 1;

	circuitIR.update(c => ({ ...c, operations: [] }));
	markAsReset();

	const probabilities: { [state: string]: number } = {};
	for (let i = 0; i < (1 << qubits); i++) {
		probabilities[i.toString(2).padStart(qubits, '0')] = i === 0 ? 1 : 0;
	}

	const blochVectors = Array.from({ length: qubits }, (_, qubit) => ({
		qubit,
		x: 0,
		y: 0,
		z: 1,
		magnitude: 1
	}));

	simulationResult.set({
		probabilities,
		formattedState: `1.00|${'0'.repeat(qubits)}⟩`,
		blochVectors
	});
}
