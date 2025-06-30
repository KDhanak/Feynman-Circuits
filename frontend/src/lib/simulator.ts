import type { CircuitState, SimulationResult, GateInstance, MatrixGateType } from "./stores";
import { circuit, SimulationResults } from '../lib/stores';
import { createComplex, formatQuantumState, formatQuantumStatePolar, magnitudeSquared } from "./quantum/complex";
import { type QuantumState, createState } from "./quantum/vector";
import { applyMatrix, extendGateMatrix, computeCNOTMatrix } from "./quantum/matrix";
import { GATE_MAP } from "./quantum/gates";
import { get } from "svelte/store";

/**
 * Simulates a quantum circuit with a single qubit.
 * Applies the gates in the circuit to the initial state |0⟩.
 * @param circuit - The CircuitState object representing the circuit.
 * @returns The simulation result containing probabilities of measuring |0⟩ and |1⟩.
 */
export function simulateSingleQubit(circuit: CircuitState): SimulationResult {
	// Initial state: |0⟩ = [1, 0]
	let state: QuantumState = createState([
		createComplex(1, 0),
		createComplex(0, 0),
	]);

	// Apply gates sequentially
	for (const gate of circuit.gates) {
		if (gate.gateType !== 'CONTROL') {
			const gateDef = GATE_MAP[gate.gateType as MatrixGateType];
			if (gateDef && gateDef.matrix.length > 0) {
				state = applyMatrix(gateDef.matrix, state);

			} else {
				console.warn(`Skipping gate: ${gate.gateType} not supported`);
			}
		}
	}

	// Calculate probabilities
	const probabilities: { [state: string]: number } = {
		'0': magnitudeSquared(state[0]),
		'1': magnitudeSquared(state[1]),
	};

	const formattedState = formatQuantumState(state);
	const formattedStatePolar = formatQuantumStatePolar(state);

	return { probabilities, formattedState, formattedStatePolar };
}

export function simulateMultipleQubits(circuit: CircuitState): SimulationResult {
	const { numQubits, gates } = circuit;
	if (numQubits < 2) {
		throw new Error('Multi-Qubit simulator requires at least 2 qubits');
	}

	const dim = 1 << numQubits;
	let state: QuantumState = createState(Array(dim).fill(null).map(() => createComplex(0, 0)));
	state[0] = createComplex(1, 0);

	const maxColumn = gates.length ? Math.max(...gates.map(g => g.columnIndex)) + 1 : 0;
	const columns = Array.from({ length: maxColumn }, (_, colIndex) =>
		gates.filter(g => g.columnIndex === colIndex)
	);

	for (const colGates of columns) {
		// Group CONTROL gates with their targets
		const controlGates = colGates.filter(g => g.gateType === 'CONTROL');
		const controlledPairs: { control: GateInstance; target: GateInstance }[] = [];

		for (const controlGate of controlGates) {
			const targetGate = colGates.find(g =>
				g.qubit === controlGate.targetQubit && g.gateType !== 'CONTROL'
			);
			if (targetGate) {
				controlledPairs.push({ control: controlGate, target: targetGate });
			}
		}

		// Apply non-controlled gates that aren't part of a controlled pair
		const controlledQubits = new Set(
			controlledPairs.flatMap(pair => [pair.control.qubit, pair.target.qubit])
		);
		for (const gate of colGates) {
			if (gate.gateType === 'CONTROL' || controlledQubits.has(gate.qubit)) continue;

			const gateDef = GATE_MAP[gate.gateType as MatrixGateType];
			if (gateDef && gateDef.matrix.length > 0) {
				const matrix = extendGateMatrix(gateDef.matrix, gate.qubit, numQubits);
				state = applyMatrix(matrix, state);
			} else {
				console.warn(`Invalid or unsupported gate type: ${gate.gateType}`);
			}
		}

		// Apply controlled gates
		for (const { control, target } of controlledPairs) {
			if (target.gateType === 'X') {
				const cnotMatrix = computeCNOTMatrix(control.qubit, target.qubit, numQubits);
				state = applyMatrix(cnotMatrix, state);
			} else {
				console.warn(`Unsupported controlled gate type: ${target.gateType}`);
				// Future: Add support for other controlled gates (e.g., controlled-Z)
			}
		}
	}

	const probabilities = Object.fromEntries(
		state.map((amplitude, idx) => {
			const bitString = idx.toString(2).padStart(numQubits, '0');
			const prob = magnitudeSquared(amplitude);
			return [bitString, prob] as [string, number];
		})
	)

	const formattedState = formatQuantumState(state);
	const formattedStatePolar = formatQuantumStatePolar(state);
	return { probabilities, formattedState, formattedStatePolar };
}

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

	SimulationResults.set({
		probabilities,
		formattedState: `1.00|${'0'.repeat(qubits)}⟩`
	});
}
