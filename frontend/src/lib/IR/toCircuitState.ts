// src/lib/IR/toCircuitState.ts

import type { CircuitIR, CircuitOperation, CanonicalUnitaryGate } from './schema';
import type { CircuitState, GateInstance, MatrixGateType } from '$lib/stores';

// Map canonical IR gate names back to your legacy gate names
const IR_TO_LEGACY_GATE: Record<CanonicalUnitaryGate, MatrixGateType> = {
	x: 'X',
	y: 'Y',
	z: 'Z',
	h: 'H',
	s: 'S',
	t: 'T'
};

function makeGateId(parts: Array<string | number>): string {
	return parts.join('_');
}

function defaultQubitLabels(numQubits: number): string[] {
	return Array.from({ length: numQubits }, (_, i) => `Qubit ${i}`);
}

function expandUnitaryOperation(op: Extract<CircuitOperation, { kind: 'unitary' }>): GateInstance[] {
	const gates: GateInstance[] = [];

	// Convert the target gate itself back into the legacy visible gate block
	// Example:
	// IR: { gate: 'x', controls: [0,1], targets: [3], column: 5 }
	// legacy target piece: { gateType: 'X', qubit: 3, columnIndex: 5 }
	for (const target of op.targets) {
		gates.push({
			id: makeGateId([op.id, 'target', target]),
			gateType: IR_TO_LEGACY_GATE[op.gate],
			qubit: target,
			columnIndex: op.column
		});
	}

	// Convert each control back into a separate CONTROL dot
	// Example:
	// IR controls [0,1,2] targeting [3]
	// becomes three CONTROL objects, each pointing to target 3
	for (const control of op.controls) {
		gates.push({
			id: makeGateId([op.id, 'control', control]),
			gateType: 'CONTROL',
			qubit: control,
			columnIndex: op.column,
			targetQubits: [...op.targets]
		});
	}

	return gates;
}

export function toCircuitState(ir: CircuitIR): CircuitState {
	const gates: GateInstance[] = [];

	for (const op of ir.operations) {
		switch (op.kind) {
			case 'unitary': {
				gates.push(...expandUnitaryOperation(op));
				break;
			}

			// Your current legacy CircuitState does not support these yet.
			// Safer to fail loudly instead of silently losing information.
			case 'measure':
				throw new Error(
					`Operation "${op.id}" is a measure operation, but legacy CircuitState does not support measurement yet.`
				);

			case 'reset':
				throw new Error(
					`Operation "${op.id}" is a reset operation, but legacy CircuitState does not support reset yet.`
				);

			case 'barrier':
				throw new Error(
					`Operation "${op.id}" is a barrier operation, but legacy CircuitState does not support barriers yet.`
				);

			default: {
				const neverOp: never = op;
				throw new Error(`Unsupported operation kind: ${JSON.stringify(neverOp)}`);
			}
		}
	}

	return {
		numQubits: ir.registers.q,
		qubitLabels:
			ir.qubitLabels.length === ir.registers.q
				? [...ir.qubitLabels]
				: defaultQubitLabels(ir.registers.q),
		gates,
		mode: 'single'
	};
}
