import type { CircuitState, SimulationResult, GateInstance, MatrixGateType } from "./stores";
import { circuit, SimulationResults } from '../lib/stores';
import { createComplex, formatQuantumState, formatQuantumStatePolar, magnitudeSquared } from "./quantum/complex";
import { type QuantumState, createState } from "./quantum/vector";
import { applyMatrix, extendGateMatrix, buildMultiControlledUMatrix } from "./quantum/matrix";
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

	const gatesInColumnOrder = [...circuit.gates].sort(
		(a, b) => a.columnIndex - b.columnIndex
	);

	// Apply gates sequentially
	for (const gate of gatesInColumnOrder) {
		if (
			gate.gateType === "CONTROLLED" ||   // skip multi-wire
			gate.qubits.length !== 1 ||   // skip anything not 1-qubit
			gate.qubits[0] !== 0                   // skip gates on other wires
		) continue;

		const gateDef = GATE_MAP[gate.gateType as MatrixGateType];
		if (gateDef && gateDef.matrix.length > 0) {
			state = applyMatrix(gateDef.matrix, state);
		} else {
			console.warn(`Skipping gate: ${gate.gateType} not supported`);
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
	/* ───── basic setup ───── */
	const { numQubits, gates } = circuit;
	if (numQubits < 2) throw new Error("Multi-Qubit simulator requires ≥ 2 qubits");

	const dim = 1 << numQubits;
	let state: QuantumState = createState(Array(dim).fill(null).map(() => createComplex(0, 0)));
	state[0] = createComplex(1, 0);

	/* ───── iterate column by column ───── */
	const maxCol = gates.length ? Math.max(...gates.map(g => g.columnIndex)) + 1 : 0;
	const columns = Array.from({ length: maxCol }, (_, c) => gates.filter(g => g.columnIndex === c));

	for (const colGates of columns) {

		/** apply every plain 1-qubit gate in this column */
		for (const gate of colGates) {
			if (gate.gateType === "CONTROLLED") continue;
			if (gate.qubits.length !== 1) continue;
			const q = gate.qubits[0];

			const def = GATE_MAP[gate.gateType as MatrixGateType];
			if (!def) { console.warn("Unsupported gate:", gate.gateType); continue; }

			const U = extendGateMatrix(def.matrix, q, numQubits);
			state = applyMatrix(U, state);
		}

		for (const gate of colGates) {
			if (gate.gateType !== "CONTROLLED") continue;
			if (!gate.controlQubits || !gate.targetQubits || gate.controlQubits.length === 0 || gate.targetQubits.length === 0) {
				console.warn("CONTROLLED gate missing control/target qubits:", gate);
				continue;
			}

			const controls = gate.controlQubits!.map(i => gate.qubits[i]);
			const targets = gate.targetQubits!.map(i => gate.qubits[i]);
			const base = gate.baseGate as MatrixGateType;

			const def = GATE_MAP[base];
			if (!def) { console.warn("Unsupported base gate:", base); continue; }

			const U = buildMultiControlledUMatrix(controls, targets, def.matrix, numQubits);
			state = applyMatrix(U, state);
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
