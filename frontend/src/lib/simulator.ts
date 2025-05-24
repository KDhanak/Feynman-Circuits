import type { CircuitState, SimulationResult, GateType, GateInstance } from "./stores";
import { createComplex, formatQuantumState, formatQuantumStatePolar, magnitudeSquared } from "./quantum/complex";
import { type QuantumState, createState, applyMatrix } from "./quantum/vector";
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
		const gateDef = GATE_MAP[gate.gateType];
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
		});
	}

	return {
		numQubits: input.numQubits,
		gates: gates,
	};
};
