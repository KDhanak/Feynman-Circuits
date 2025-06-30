import { generateDefaultQubitLabels } from "./qubitLables";
import type { CircuitState, GateType, GateInstance, QubitMode } from "./stores";
import type { ImportedCircuit, ErrorResponse } from "./stores";

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

	const validGates: GateType[] = ["X", "Y", "Z", "H", "S", "T", "CONTROL"];
	const gates: GateInstance[] = [];

	for (const gateInput of input.gates) {
		if (!validGates.includes(gateInput.gate as GateType)) {
			return { detail: `Invalid gate type: ${gateInput.gate}` };
		}

		if (gateInput.qubit < 0 || gateInput.qubit >= input.numQubits) {
			return { detail: `Invalid target qubit: ${gateInput.qubit}` };
		}

		if (gateInput.gate === 'CONTROL') {
			if (
				typeof gateInput.targetQubit !== 'number' ||
				gateInput.targetQubit < 0 ||
				gateInput.targetQubit >= input.numQubits
			) {
				return { detail: `Invalid or missing targetQubit for CONTROL gate` };
			}
			if (gateInput.targetQubit === gateInput.qubit) {
				return { detail: `CONTROL gate's control and target cannot be the same` };
			}
		}

		gates.push({
			id: crypto.randomUUID(),
			gateType: gateInput.gate as GateType,
			qubit: gateInput.qubit,
			columnIndex: gateInput.columnIndex,
			...(gateInput.gate === 'CONTROL' ? { targetQubit: gateInput.targetQubit } : {})
		});

	};

	const mode: QubitMode = input.mode ? input.mode : (input.numQubits === 1 ? 'single' : 'multi');

	const labels = input.qubitLabels?.slice(0, input.numQubits) ?? generateDefaultQubitLabels(input.numQubits);

	return {
		numQubits: input.numQubits,
		gates: gates,
		qubitLabels: labels,
		mode: mode,
	};
};
