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

	const validGates: GateType[] = ["X", "Y", "Z", "H", "S", "T", "CONTROL", "MEASURE"];
	const gates: GateInstance[] = [];
	const occupiedSlots = new Set<string>();
	const gateMap = new Map<string, (typeof input.gates)[number]>();

	for (const gateInput of input.gates) {
		if (!validGates.includes(gateInput.gate as GateType)) {
			return { detail: `Invalid gate type: ${gateInput.gate}` };
		}

		if (
			typeof gateInput.qubit !== "number" ||
			!Number.isInteger(gateInput.qubit) ||
			gateInput.qubit < 0 ||
			gateInput.qubit >= input.numQubits
		) {
			return { detail: `Invalid target qubit: ${gateInput.qubit}` };
		}

		if (
			typeof gateInput.columnIndex !== "number" ||
			!Number.isInteger(gateInput.columnIndex) ||
			gateInput.columnIndex < 0
		) {
			return { detail: `Invalid columnIndex: ${gateInput.columnIndex}` };
		}

		const slotKey = `${gateInput.qubit}-${gateInput.columnIndex}`;

		if (occupiedSlots.has(slotKey)) {
			return {
				detail: `Multiple gates cannot exist on qubit ${gateInput.qubit} in column ${gateInput.columnIndex}`
			};
		}

		occupiedSlots.add(slotKey);
		gateMap.set(slotKey, gateInput);

		if (gateInput.gate === "CONTROL") {
			const hasLegacy = typeof gateInput.targetQubit === "number";
			const hasNew = Array.isArray(gateInput.targetQubits) && gateInput.targetQubits.length > 0;

			if (!hasLegacy && !hasNew) {
				return { detail: "Invalid or missing targetQubit(s) for CONTROL gate" };
			}

			const targetsList = hasNew ? gateInput.targetQubits! : [gateInput.targetQubit!];

			const uniqueTargets = new Set<number>();

			for (const target of targetsList) {
				if (
					typeof target !== "number" ||
					!Number.isInteger(target) ||
					target < 0 ||
					target >= input.numQubits
				) {
					return { detail: `Invalid target qubit: ${target}` };
				}

				if (target === gateInput.qubit) {
					return { detail: "CONTROL gate's control and target cannot be the same" };
				}

				if (uniqueTargets.has(target)) {
					return { detail: `Duplicate target qubit ${target} in CONTROL gate` };
				}

				uniqueTargets.add(target);
			}
		}

		gates.push({
			id: crypto.randomUUID(),
			gateType: gateInput.gate as GateType,
			qubit: gateInput.qubit,
			columnIndex: gateInput.columnIndex,
			...(gateInput.gate === "CONTROL"
				? {
						targetQubit: gateInput.targetQubit,
						targetQubits: gateInput.targetQubits
					}
				: {})
		});
	}

	// Second pass: validate CONTROL gate relationships
	for (const gateInput of input.gates) {
		if (gateInput.gate !== "CONTROL") continue;

		const targetsList =
			Array.isArray(gateInput.targetQubits) && gateInput.targetQubits.length > 0
				? gateInput.targetQubits
				: typeof gateInput.targetQubit === "number"
					? [gateInput.targetQubit]
					: [];

		for (const target of targetsList) {
			const targetKey = `${target}-${gateInput.columnIndex}`;
			const targetGate = gateMap.get(targetKey);

			if (!targetGate) {
				return {
					detail: `Missing target gate on qubit ${target} in column ${gateInput.columnIndex} for CONTROL gate on qubit ${gateInput.qubit}`
				};
			}

			if (targetGate.gate === "CONTROL") {
				return {
					detail: `Expected target operation on qubit ${target} in column ${gateInput.columnIndex}, but found another CONTROL gate`
				};
			}
		}
	}

	const mode: QubitMode = input.mode ? input.mode : input.numQubits === 1 ? "single" : "multi";

	const labels =
		input.qubitLabels?.slice(0, input.numQubits) ?? generateDefaultQubitLabels(input.numQubits);

	return {
		numQubits: input.numQubits,
		gates,
		qubitLabels: labels,
		mode
	};
}
