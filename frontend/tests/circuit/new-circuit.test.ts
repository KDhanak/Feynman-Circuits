import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Starting a new circuit, and how it differs from clearing the board.
 *
 * Clearing keeps the circuit's id and name, so for a signed-in user the next
 * edit auto-saves the new work over the circuit that was open. Starting a new
 * circuit must hand the board a fresh id, so the old one is left alone.
 */

const upsertCircuit = vi.fn(async (circuit_id: string, name: string, _ir: unknown) => ({
	circuit_id,
	name
}));
vi.mock('$lib/api/circuitApi', () => ({
	upsertCircuit: (id: string, name: string, ir: unknown) => upsertCircuit(id, name, ir),
	getNextUntitledName: async () => 'Untitled Circuit 2'
}));
vi.mock('$lib/utils/notificationUtils', () => ({ showNotification: vi.fn() }));

import { get } from 'svelte/store';
import { saveThenStartNewCircuit, startNewCircuit } from '$lib/circuit/circuitActions';
import { session } from '$lib/auth/session';
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
	upsertCircuit.mockClear();
	session.set({ status: 'anonymous', user: null });
	openSavedCircuit();
});

function signIn() {
	session.set({
		status: 'authenticated',
		user: { id: 1, email: 'user@example.com', first_name: 'A', last_name: 'B' }
	});
}

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

describe('saveThenStartNewCircuit', () => {
	it('saves the circuit that is on its way out, under its own id and gates', async () => {
		signIn();

		await saveThenStartNewCircuit();

		expect(upsertCircuit).toHaveBeenCalledOnce();
		const [id, name, ir] = upsertCircuit.mock.calls[0];
		expect(id).toBe('saved-circuit-id');
		expect(name).toBe('Bell pair');
		// The old gates, not the empty board that replaces them a moment later.
		expect((ir as CircuitIR).operations).toHaveLength(1);
	});

	it('only then starts the new circuit', async () => {
		signIn();

		await saveThenStartNewCircuit();

		expect(get(currentCircuitId)).not.toBe('saved-circuit-id');
		expect(get(circuitIR).operations).toEqual([]);
	});

	it('keeps the circuit on the board when the save fails', async () => {
		signIn();
		upsertCircuit.mockRejectedValueOnce(new Error('network down'));

		await saveThenStartNewCircuit();

		// Nothing was cleared: losing the work we could not save is the one
		// outcome this has to rule out.
		expect(get(currentCircuitId)).toBe('saved-circuit-id');
		expect(get(currentCircuitName)).toBe('Bell pair');
		expect(get(circuitIR).operations).toHaveLength(1);
	});

	it('just starts fresh when signed out, since there is nowhere to save to', async () => {
		await saveThenStartNewCircuit();

		expect(upsertCircuit).not.toHaveBeenCalled();
		expect(get(currentCircuitId)).not.toBe('saved-circuit-id');
		expect(get(circuitIR).operations).toEqual([]);
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
