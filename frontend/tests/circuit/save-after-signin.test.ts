import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Saving a circuit that was received while signed out.
 *
 * The steps a person really follows (open a share link with no account, sign
 * in from the side panel, then save) used to fail with "Failed to save
 * circuit", without ever sending a request. `applyCircuit` marks a received
 * circuit as reset so auto-save leaves it alone, and nothing cleared that flag
 * while the user was signed out, so the save stopped before making a request.
 */

const upsert = vi.fn(async (id: string, name: string, _ir: unknown) => ({
	circuit_id: id,
	name
}));
vi.mock('../../src/lib/api/circuitApi', () => ({
	upsertCircuit: (id: string, name: string, ir: unknown) => upsert(id, name, ir),
	getNextUntitledName: async () => 'Untitled Circuit 2'
}));

import { get } from 'svelte/store';
import { applyCircuit } from '../../src/lib/circuit/applyCircuit';
import { manualSave, resetAutoSaveState, isCircuitSaved } from '../../src/lib/circuit/autoSave';
import { session } from '../../src/lib/auth/session';
import { circuitIR, currentCircuitId, currentCircuitName } from '../../src/lib/IR/stores';
import type { CircuitIR } from '../../src/lib/IR/schema';

function ir(gates = 0): CircuitIR {
	return {
		version: '1.0',
		registers: { q: 2, c: 0 },
		qubitLabels: ['Qubit 0', 'Qubit 1'],
		operations: Array.from({ length: gates }, () => ({
			id: crypto.randomUUID(),
			kind: 'unitary' as const,
			gate: 'h' as const,
			column: 0,
			targets: [0],
			controls: [],
			antiControls: [],
			params: []
		}))
	};
}

const USER = { id: 1, email: 'recipient@example.com', first_name: '', last_name: '' };

function signOut() {
	session.set({ status: 'anonymous', user: null });
}

function signIn() {
	session.set({ status: 'authenticated', user: USER });
}

describe('saving a circuit received while signed out', () => {
	beforeEach(() => {
		resetAutoSaveState();
		upsert.mockClear();
		currentCircuitId.set('');
		currentCircuitName.set('Untitled Circuit');
		isCircuitSaved.set(false);
	});

	it('saves an untouched shared circuit after the user signs in', async () => {
		signOut();
		// Opened with /?circuit=<sender's id>, so the board has the sender's id.
		applyCircuit(ir(), { id: 'senders-id', name: 'Bell', saved: false });

		signIn();
		await expect(manualSave()).resolves.toBeUndefined();

		expect(upsert).toHaveBeenCalledTimes(1);
		expect(upsert.mock.calls[0][0]).toBe('senders-id');
		expect(get(isCircuitSaved)).toBe(true);
	});

	it('saves a circuit that was edited while signed out', async () => {
		signOut();
		applyCircuit(ir(), { id: 'senders-id', name: 'Bell', saved: false });
		circuitIR.set(ir(1)); // the user adds a gate before signing in

		signIn();
		await expect(manualSave()).resolves.toBeUndefined();

		expect(upsert).toHaveBeenCalledTimes(1);
	});

	it('adopts the id and name the server stored the copy under', async () => {
		// This user already has a "Bell", so the backend makes a copy with a new id
		// and a new name. The board has to switch to both.
		upsert.mockResolvedValueOnce({ circuit_id: 'my-own-copy', name: 'Bell (copy)' });

		signOut();
		applyCircuit(ir(), { id: 'senders-id', name: 'Bell', saved: false });
		signIn();
		await manualSave();

		expect(get(currentCircuitId)).toBe('my-own-copy');
		expect(get(currentCircuitName)).toBe('Bell (copy)');
	});

	it('still refuses to save while signed out', async () => {
		signOut();
		applyCircuit(ir(), { id: 'senders-id', name: 'Bell', saved: false });
		circuitIR.set(ir(1));

		await expect(manualSave()).rejects.toThrow();
		expect(upsert).not.toHaveBeenCalled();
	});

	it('leaves an untouched circuit alone until something asks for a save', async () => {
		// Tracking edits while signed out must not count `applyCircuit` itself as an
		// edit. Just opening a share link should not save anything.
		signIn();
		applyCircuit(ir(), { id: 'senders-id', name: 'Bell', saved: false });

		expect(upsert).not.toHaveBeenCalled();
	});
});
