import type { CircuitState, SimulationResult, MatrixGateType, GateInstance } from "./stores";
import { circuit, SimulationResults } from '../lib/stores';
import { createComplex, formatQuantumState, formatQuantumStatePolar, magnitudeSquared, scale } from "./quantum/complex";
import { type QuantumState, createState } from "./quantum/vector";
import { applyMatrix, extendGateMatrix, computeMultiControlledUMatrix } from "./quantum/matrix";
import { GATE_MAP } from "./quantum/gates";
import { get } from "svelte/store";
import { computeBlochVectorsFromState } from './quantum/bloch';

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
	const pos = numQubits - 1 - qubit;        // qubit 0 = highest bit

	// Step 1: Calculate probability of measuring |0⟩ for this qubit
	let prob0 = 0;
	const blockSize = 1 << pos;               // size of each 0/1 pair block

	for (let base = 0; base < dim; base += 2 * blockSize) {
		for (let offset = 0; offset < blockSize; offset++) {
			prob0 += magnitudeSquared(state[base + offset]);
		}
	}

	// Step 2: Randomly choose outcome (this is the "quantum randomness")
	const outcome = prob0 > 0.5 ? 0 : 1;

	// Step 3: Keep only the amplitudes for the chosen outcome
	const newState = state.map((amp, index) => {
		const bit = (index >> pos) & 1;
		return bit === outcome ? amp : createComplex(0, 0);
	});

	// Step 4: Renormalize so total probability = 1
	const totalProb = newState.reduce((sum, amp) => sum + magnitudeSquared(amp), 0);
	const norm = Math.sqrt(totalProb || 1);

	return {
		newState: newState.map(amp => scale(amp, 1 / norm)),
		outcome
	};
}

export function skipIfMeasured(
	gate: GateInstance,
	measuredQubits: Set<number>
): boolean {
	return measuredQubits.has(gate.qubit);
}

// ─────────────────────────────────────────────────────────────
// 1. Single-qubit simulator (Corrected)
export function simulateSingleQubit(circuit: CircuitState): SimulationResult {
	let state: QuantumState = createState([createComplex(1, 0), createComplex(0, 0)]);
	const measuredQubits = new Set<number>();
	const classicalBits = new Map<number, number>();   // qubit → classical 0 or 1

	const gatesInColumnOrder = [...circuit.gates].sort((a, b) => a.columnIndex - b.columnIndex);

	for (const gate of gatesInColumnOrder) {
		if (gate.gateType === 'MEASURE') {
			measuredQubits.add(gate.qubit);
			const result = collapseQubit(state, gate.qubit, 1);   // updated call
			state = result.newState;
			classicalBits.set(gate.qubit, result.outcome);
			continue;
		}

		if (skipIfMeasured(gate, measuredQubits)) {
			// Classical gate after measurement
			if (gate.gateType === 'X') {
				let current = classicalBits.get(gate.qubit) ?? 0;
				current = 1 - current;                    // flip 0 <-> 1
				classicalBits.set(gate.qubit, current);

				// Update the quantum state to reflect the classical value
				const pos = 0; // single qubit
				state = state.map((amp, index) => {
					return index === current ? amp : createComplex(0, 0);
				});
				// No need to renormalize since it's already a basis state
			}
			// Ignore all other gates after measurement
			continue;
		}

		if (gate.gateType === 'CONTROL') continue;

		const gateDef = GATE_MAP[gate.gateType as MatrixGateType];
		if (gateDef && gateDef.matrix.length > 0) {
			state = applyMatrix(gateDef.matrix, state);
		}
	}

	const probabilities = {
		'0': magnitudeSquared(state[0]),
		'1': magnitudeSquared(state[1])
	};

	const formattedState = formatQuantumState(state);
	const formattedStatePolar = formatQuantumStatePolar(state);
	const blochVectors = computeBlochVectorsFromState(state, 1);

	return {
		probabilities,
		formattedState,
		formattedStatePolar,
		blochVectors,
		measuredQubits: Array.from(measuredQubits).sort((a, b) => a - b),
		classicalBits
	};
}

// ─────────────────────────────────────────────────────────────
// 2. Multi-qubit simulator with classical post-measurement support
export function simulateMultipleQubits(circuit: CircuitState): SimulationResult {
	const { numQubits, gates } = circuit;
	if (numQubits < 2) throw new Error('Multi-Qubit simulator requires at least 2 qubits');

	const dim = 1 << numQubits;
	let state: QuantumState = createState(Array(dim).fill(null).map(() => createComplex(0, 0)));
	state[0] = createComplex(1, 0);

	const measuredQubits = new Set<number>();
	const classicalBits = new Map<number, number>();   // qubit → classical 0 or 1

	const maxColumn = gates.length ? Math.max(...gates.map(g => g.columnIndex)) + 1 : 0;
	const columns = Array.from({ length: maxColumn }, (_, colIndex) =>
		gates.filter(g => g.columnIndex === colIndex)
	);

	for (const colGates of columns) {
		// CONTROL aggregation
		const controlGates = colGates.filter(g => g.gateType === 'CONTROL');
		const controlsByTarget = new Map<number, number[]>();
		for (const ctrl of controlGates) {
			const targets = ctrl.targetQubits ?? (ctrl.targetQubit !== undefined ? [ctrl.targetQubit] : []);
			for (const targetQubit of targets) {
				const arr = controlsByTarget.get(targetQubit) ?? [];
				arr.push(ctrl.qubit);
				controlsByTarget.set(targetQubit, arr);
			}
		}

		const controlledQubits = new Set<number>();
		for (const [t, ctrls] of controlsByTarget) {
			controlledQubits.add(t);
			ctrls.forEach(c => controlledQubits.add(c));
		}

		// Independent gates
		for (const gate of colGates) {
			if (gate.gateType === 'CONTROL' || controlledQubits.has(gate.qubit)) continue;

			if (gate.gateType === 'MEASURE') {
				measuredQubits.add(gate.qubit);
				const result = collapseQubit(state, gate.qubit, numQubits);
				state = result.newState;
				classicalBits.set(gate.qubit, result.outcome);
				continue;
			}

			if (skipIfMeasured(gate, measuredQubits)) {
				// Classical gate after measurement
				if (gate.gateType === 'X') {
					let current = classicalBits.get(gate.qubit) ?? 0;
					current = 1 - current;                    // flip 0 <-> 1
					classicalBits.set(gate.qubit, current);

					// Update quantum state to reflect new classical value
					const pos = numQubits - 1 - gate.qubit;
					const mask = 1 << pos;
					state = state.map((amp, index) => {
						const bit = (index >> pos) & 1;
						return bit === current ? amp : createComplex(0, 0);
					});
				}
				// Ignore other gates (H, Y, Z, etc.)
				continue;
			}

			const gateDef = GATE_MAP[gate.gateType as MatrixGateType];
			if (gateDef && gateDef.matrix.length > 0) {
				const matrix = extendGateMatrix(gateDef.matrix, gate.qubit, numQubits);
				state = applyMatrix(matrix, state);
			}
		}

		// Controlled gates (block if target is measured)
		for (const [targetQubit, controlQubits] of controlsByTarget) {
			if (measuredQubits.has(targetQubit)) continue;

			const targetGate = colGates.find(g => g.qubit === targetQubit && g.gateType !== 'CONTROL' && g.gateType !== 'MEASURE');
			if (!targetGate) continue;

			const gateDef = GATE_MAP[targetGate.gateType as MatrixGateType];
			if (!gateDef || gateDef.matrix.length === 0) continue;

			const matrix = computeMultiControlledUMatrix(controlQubits, targetQubit, numQubits, gateDef.matrix);
			state = applyMatrix(matrix, state);
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
};

export function resetCircuit() {
	const current = get(circuit);
	const qubits = current.numQubits;
	circuit.set({
		numQubits: qubits,
		gates: []
	});

	const probabilities: { [state: string]: number } = {};
	for (let i = 0; i < 1 << qubits; i++) {
		probabilities[i.toString(2).padStart(qubits, '0')] = i === 0 ? 1 : 0;
	}

	const blochVectors = Array.from({ length: qubits }, (_, qubit) => ({
		qubit,
		x: 0,
		y: 0,
		z: 1,
		magnitude: 1
	}));


	SimulationResults.set({
		probabilities,
		formattedState: `1.00|${'0'.repeat(qubits)}⟩`,
		blochVectors
	});
}
