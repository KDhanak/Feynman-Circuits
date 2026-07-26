import type { CircuitOperation } from './schema';
import { circuitIR } from './stores';

export function insertOperation(op: CircuitOperation) {
	circuitIR.update((c) => ({
		...c,
		operations: [...c.operations, op]
	}));
}

export function removeOperation(id: string) {
	circuitIR.update((c) => ({
		...c,
		operations: c.operations.filter((op) => op.id !== id)
	}));
}

export function updateOperation(id: string, updater: (op: CircuitOperation) => CircuitOperation) {
	circuitIR.update((c) => ({
		...c,
		operations: c.operations.map((op) => (op.id === id ? updater(op) : op))
	}));
}

export function setNumQubitsIR(n: number) {
	circuitIR.update((c) => ({
		...c,
		registers: {
			...c.registers,
			q: n
		},
		qubitLabels: Array.from({ length: n }, (_, i) => `Qubit ${i}`)
	}));
}
