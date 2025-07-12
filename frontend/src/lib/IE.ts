import { generateDefaultQubitLabels } from "./qubitLables";
import type { CircuitState, GateType, GateInstance, QubitMode } from "./stores";
import type { ExportCircuit, ErrorResponse } from "./stores";

/**
 * Converts user imported circuit to the internal CircuitState format.
 * Validates the circuit and returns an error response if invalid.
 * @param input - The imported circuit object.
 * @returns The internal CircuitState or an error response.
 */
export function importCircuit(input: ExportCircuit): CircuitState | ErrorResponse {
	if (input.numQubits < 1) {
		return { detail: "Number of qubits must be at least 1" };
	}

	const validGates: GateType[] = ["X", "Y", "Z", "H", "S", "T", "CONTROLLED"];
	const gates: GateInstance[] = [];

	for (const gateInput of input.gates) {
		if (!validGates.includes(gateInput.gateType as GateType)) {
			return { detail: `Invalid gate type: ${gateInput.gateType}` };
		}

		const outOfRange = gateInput.qubits.some(q => q < 0 || q >= input.numQubits);
		if (outOfRange) {
			return { detail: `One or more qubits out of range in gate ${gateInput.gateType}` };
		}

		const hasDupes = new Set(gateInput.qubits).size !== gateInput.qubits.length;
		if (hasDupes) {
			return { detail: `Duplicate qubit indices in gate ${gateInput.gateType}` };
		}

		if (gateInput.gateType === 'CONTROLLED') {
			if (!gateInput.baseGate || !gateInput.controlQubits || !gateInput.targetQubits) {
				return { detail: "CONTROLLED gate is missing baseGate / controls / targets" };
			}

			const { qubits } = gateInput;
			if (new Set(qubits).size !== qubits.length) {
				return { detail: `Duplicate qubit indices in CONTROLLED gate ${gateInput.baseGate}` };
			}

			const outOfRange = qubits.some(q => q < 0 || q >= input.numQubits);
			if (outOfRange) {
				return { detail: `One or more qubits out of range in CONTROLLED gate ${gateInput.baseGate}` };
			}

			const badCtrl = gateInput.controlQubits?.some(i => i < 0 || i >= qubits.length);
			const badTgt = gateInput.targetQubits?.some(i => i < 0 || i >= qubits.length);
			if (badCtrl || badTgt) {
				return { detail: `CONTROLLED gate ${gateInput.baseGate} has control or target qubits out of range` };
			}

			const overlap = gateInput.controlQubits.some(i => gateInput.targetQubits?.includes(i));
			if (overlap) {
				return { detail: "A wire cannot be both control and target in the same gate" };
			}

			if (gateInput.controlQubits.length === 0 || gateInput.targetQubits?.length === 0) {
				return { detail: "CONTROLLED gate needs at least one control and one target" };
			}
		}

		gates.push({
			id: crypto.randomUUID(),
			gateType: gateInput.gateType as GateType,
			qubits: gateInput.qubits,
			columnIndex: gateInput.columnIndex,
			...(gateInput.gateType === 'CONTROLLED' && { baseGate: gateInput.baseGate, controlQubits: gateInput.controlQubits, targetQubits: gateInput.targetQubits })
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
