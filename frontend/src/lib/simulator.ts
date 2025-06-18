import type { CircuitState, SimulationResult, GateType, GateInstance, MatrixGateType } from "./stores";
import { createComplex, formatQuantumState, formatQuantumStatePolar, magnitudeSquared } from "./quantum/complex";
import { type QuantumState, createState } from "./quantum/vector";
import { applyMatrix, extendGateMatrix, computeCNOTMatrix } from "./quantum/matrix";
import { GATE_MAP } from "./quantum/gates";

export interface ImportedGate {
	gate: string;
	qubit: number;
}

export interface ImportedCircuit {
	gates: ImportedGate[];
	numQubits: number;
}

export interface ErrorResponse {
	detail?: string;
}

/**
 * Simulates a quantum circuit with a single qubit.
 * Applies the gates in the circuit to the initial state |0⟩.
 * @param circuit - The CircuitState object representing the circuit.
 * @returns The simulation result containing probabilities of measuring |0⟩ and |1⟩.
 */
export function simulateSingleQubit(circuit: CircuitState): SimulationResult {
	// Validate circuit
	if (circuit.numQubits !== 1) {
		throw new Error('Simulator supports only 1 qubit');
	}

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

	const controlGates = gates.filter((g) => g.gateType === 'CONTROL' && g.targetQubit !== undefined);
	const otherGates = gates.filter((g) => g.gateType !== 'CONTROL');

	for (const gate of otherGates) {
		if (gate.gateType !== 'X' || !controlGates.some((cg) => cg.targetQubit === gate.qubit)) {
			const gateDef = GATE_MAP[gate.gateType as MatrixGateType];
			if (gateDef && gateDef.matrix.length > 0) {
				const matrix = extendGateMatrix(gateDef.matrix, gate.qubit, numQubits);
				state = applyMatrix(matrix, state);
			} else {
				console.warn(`Skipping gate: ${gate.gateType} not supported`);
			}
		}
	}

	for (const controlGate of controlGates) {
		const targetGate = gates.find((g) =>
			g.columnIndex === controlGate.columnIndex &&
			g.qubit === controlGate.targetQubit
		);
		if (targetGate) {
			const cnotMatrix = computeCNOTMatrix(controlGate.qubit, controlGate.targetQubit!, numQubits);
			state = applyMatrix(cnotMatrix, state);
		}
	}

	const probabilities: { [state: string]: number } = {};
	for (let i = 0; i < dim; i++) {
		const stateStr = i.toString(2).padStart(numQubits, '0');
		probabilities[stateStr] = magnitudeSquared(state[i]);
	}
	const formattedState = formatQuantumState(state);
	const formattedStatePolar = formatQuantumStatePolar(state);
	return { probabilities, formattedState, formattedStatePolar };
}

/**
 * Converts user imported circuit to the internal CircuitState format.
 * Validates the circuit and returns an error response if invalid.
 * @param input - The imported circuit object.
 * @returns The internal CircuitState or an error response.
 */
export function importCircuit(input: ImportedCircuit): CircuitState | ErrorResponse {
	if (input.numQubits < 1) {
		return { detail: "Number of qubits must be at least 1" };
	}

	const validGates: GateType[] = ["X", "Y", "Z", "H", "S", "T"];
	const gates: GateInstance[] = [];

	for (const gateInput of input.gates) {
		if (!validGates.includes(gateInput.gate as GateType)) {
			return { detail: `Invalid gate type: ${gateInput.gate}` };
		}

		if (gateInput.qubit < 0 || gateInput.qubit >= input.numQubits) {
			return { detail: `Invalid target qubit: ${gateInput.qubit}` };
		}

		gates.push({
			id: crypto.randomUUID(),
			gateType: gateInput.gate as GateType,
			qubit: gateInput.qubit,
			targetQubit: gateInput.gate === 'CONTROL' ? undefined : undefined,
			columnIndex: 0, // Default column index for imported gates
		});
	}

	return {
		numQubits: input.numQubits,
		gates: gates,
	};
};
