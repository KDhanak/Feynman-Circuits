import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { undo, redo, resetHistory, canUndo, canRedo } from '../../src/lib/IR/history';
import { applyCircuit } from '../../src/lib/circuit/applyCircuit';
import { circuitIR } from '../../src/lib/IR/stores';
import { insertOperation, setNumQubitsIR } from '../../src/lib/IR/operations';
import type { CircuitIR, CircuitOperation } from '../../src/lib/IR/schema';

// How long history waits for changes to stop before it keeps a copy.
const SETTLE_MS = 250;

function emptyCircuit(qubits = 2): CircuitIR {
	return {
		version: '1.0',
		registers: { q: qubits, c: 0 },
		qubitLabels: Array.from({ length: qubits }, (_, i) => `Qubit ${i}`),
		operations: []
	};
}

function gate(gateType: 'h' | 'x', column: number, target: number): CircuitOperation {
	return {
		id: crypto.randomUUID(),
		kind: 'unitary',
		gate: gateType,
		column,
		targets: [target],
		controls: [],
		antiControls: [],
		params: []
	};
}

function gateCount(): number {
	return get(circuitIR).operations.length;
}

// Do an edit and let the settle timer run out, so it becomes one undo step.
function edit(change: () => void) {
	change();
	vi.advanceTimersByTime(SETTLE_MS);
}

describe('undo / redo', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		circuitIR.set(emptyCircuit());
		resetHistory(get(circuitIR));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('steps back to the circuit as it was before the edit', () => {
		edit(() => insertOperation(gate('h', 0, 0)));
		expect(gateCount()).toBe(1);

		undo();
		expect(gateCount()).toBe(0);

		redo();
		expect(gateCount()).toBe(1);
	});

	it('treats one action that changes the store twice as one step', () => {
		// This is what dropping a gate on a new wire does: it adds the qubit and
		// then adds the gate, in two separate store changes.
		edit(() => {
			setNumQubitsIR(3);
			insertOperation(gate('x', 0, 2));
		});

		undo();

		expect(gateCount()).toBe(0);
		expect(get(circuitIR).registers.q).toBe(2);
		expect(get(canUndo)).toBe(false);
	});

	it('undoes an edit that has just happened, before the wait is over', () => {
		insertOperation(gate('h', 0, 0));
		// No timer advance here: the user pressed Ctrl+Z straight after the drop.
		undo();

		expect(gateCount()).toBe(0);
	});

	it('drops the steps of the circuit that was open before a new one is loaded', () => {
		edit(() => insertOperation(gate('h', 0, 0)));

		const loaded = emptyCircuit(2);
		loaded.operations = [gate('x', 0, 1)];
		applyCircuit(loaded, { id: 'server-uuid', name: 'Loaded', saved: true });

		expect(get(canUndo)).toBe(false);
		undo();

		// Still the loaded circuit, not the one that was on the board before it.
		expect(get(circuitIR).operations[0].gate).toBe('x');
		expect(gateCount()).toBe(1);
	});

	it('has nothing to redo after a new edit', () => {
		edit(() => insertOperation(gate('h', 0, 0)));
		undo();
		expect(get(canRedo)).toBe(true);

		edit(() => insertOperation(gate('x', 1, 1)));

		expect(get(canRedo)).toBe(false);
		redo();
		expect(gateCount()).toBe(1);
	});

	it('does nothing when there is nothing to go back to', () => {
		expect(get(canUndo)).toBe(false);
		undo();
		expect(gateCount()).toBe(0);
	});
});
