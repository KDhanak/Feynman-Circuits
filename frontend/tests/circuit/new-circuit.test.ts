import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Starting a new circuit, and how it differs from clearing the board.
 *
 * Clearing keeps the circuit's id and name, so for a signed-in user the next
 * edit auto-saves the new work over the circuit that was open. Starting a new
 * circuit must hand the board a fresh id, so the old one is left alone.
 */

vi.mock('$lib/api/circuitApi', () => ({
	upsertCircuit: vi.fn(),
	getNextUntitledName: async () => 'Untitled Circuit 2'
}));
vi.mock('$lib/utils/notificationUtils', () => ({ showNotification: vi.fn() }));

import { get } from 'svelte/store';
import { startNewCircuit } from '$lib/circuit/circuitActions';
import { resetCircuit } from '$lib/circuit/simulator';
import { isCircuitSaved, resetAutoSaveState } from '$lib/circuit/autoSave';
import { canUndo } from '$lib/IR/history';
import {
	circuitIR,
	currentCircuitId,
	currentCircuitIsPublic,
	currentCircuitName
} from '$lib/IR/stores';
import type { CircuitIR } from '$lib/IR/schema';

function savedCircuit(): CircuitIR {
	return {
		version: '1.0',
		registers: { q: 3, c: 0 },
		qubitLabels: ['Alice', 'Bob', 'Charlie'],
		operations: [
			{
				id: crypto.randomUUID(),
				kind: 'unitary',
				gate: 'h',
				column: 0,
				targets: [0],
				controls: [],
				antiControls: [],
				params: []
			}
		]
	};
}

// Puts the app in the state it is in just after opening a saved circuit.
function openSavedCircuit() {
	resetAutoSaveState();
	currentCircuitId.set('saved-circuit-id');
	currentCircuitName.set('Bell pair');
	currentCircuitIsPublic.set(true);
	isCircuitSaved.set(true);
	circuitIR.set(savedCircuit());
}

beforeEach(() => {
	openSavedCircuit();
});

describe('startNewCircuit', () => {
	it('gives the board a different id, so the circuit that was open is not written over', () => {
		startNewCircuit();

		expect(get(currentCircuitId)).not.toBe('saved-circuit-id');
		expect(get(currentCircuitId)).not.toBe('');
		expect(get(isCircuitSaved)).toBe(false);
	});

	it('starts from an empty one-qubit board with default labels', () => {
		startNewCircuit();

		const ir = get(circuitIR);
		expect(ir.operations).toEqual([]);
		expect(ir.registers).toEqual({ q: 1, c: 0 });
		expect(ir.qubitLabels).toEqual(['Qubit 0']);
	});

	it('takes the old name and public flag off the new circuit', () => {
		startNewCircuit();

		expect(get(currentCircuitName)).toBe('Untitled Circuit');
		expect(get(currentCircuitIsPublic)).toBe(false);
	});

	it('leaves nothing to undo back into the old circuit', () => {
		startNewCircuit();

		expect(get(canUndo)).toBe(false);
	});
});

describe('clearing the board is not the same thing', () => {
	it('keeps the id and name, which is why a separate action is needed', () => {
		resetCircuit();

		expect(get(currentCircuitId)).toBe('saved-circuit-id');
		expect(get(currentCircuitName)).toBe('Bell pair');
		expect(get(circuitIR).operations).toEqual([]);
		// The qubits the user added stay, too.
		expect(get(circuitIR).registers.q).toBe(3);
	});
});
