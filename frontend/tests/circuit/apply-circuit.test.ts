import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { applyCircuit } from '../../src/lib/circuit/applyCircuit';
import { isCircuitSaved } from '../../src/lib/circuit/autoSave';
import {
	circuitIR,
	currentCircuitId,
	currentCircuitIsPublic,
	currentCircuitName
} from '../../src/lib/IR/stores';
import type { CircuitIR } from '../../src/lib/IR/schema';

function ir(gate: 'h' | 'x'): CircuitIR {
	return {
		version: '1.0',
		registers: { q: 2, c: 0 },
		qubitLabels: ['Qubit 0', 'Qubit 1'],
		operations: [
			{
				id: crypto.randomUUID(),
				kind: 'unitary',
				gate,
				column: 0,
				targets: [0],
				controls: [],
				antiControls: [],
				params: []
			}
		]
	};
}

describe('applyCircuit', () => {
	beforeEach(() => {
		currentCircuitId.set('');
		currentCircuitName.set('Untitled Circuit');
		isCircuitSaved.set(false);
		currentCircuitIsPublic.set(false);
	});

	it('adopts the server identity when loading a saved circuit', () => {
		applyCircuit(ir('h'), { id: 'server-uuid', name: 'Bell', saved: true });

		expect(get(currentCircuitId)).toBe('server-uuid');
		expect(get(currentCircuitName)).toBe('Bell');
		expect(get(isCircuitSaved)).toBe(true);
		expect(get(circuitIR).operations[0].gate).toBe('h');
	});

	it('mints a fresh id for a circuit with no server identity', () => {
		applyCircuit(ir('h'), { name: 'Imported' });

		expect(get(currentCircuitId)).not.toBe('');
		expect(get(isCircuitSaved)).toBe(false);
	});

	it('does not overwrite the circuit that was already open', () => {
		// The regression this helper exists to prevent: auto-save writes to
		// whatever currentCircuitId holds, so an import that leaves the previous
		// id in place would persist itself over the user's saved circuit.
		applyCircuit(ir('h'), { id: 'saved-circuit', name: 'My Work', saved: true });
		expect(get(currentCircuitId)).toBe('saved-circuit');

		applyCircuit(ir('x'), { name: 'Imported From Elsewhere' });

		expect(get(currentCircuitId)).not.toBe('saved-circuit');
		expect(get(isCircuitSaved)).toBe(false);
		expect(get(circuitIR).operations[0].gate).toBe('x');
	});

	it('treats an explicit id as saved by default', () => {
		applyCircuit(ir('h'), { id: 'server-uuid' });
		expect(get(isCircuitSaved)).toBe(true);
	});

	it('can hold an identified circuit as unsaved, for a public circuit a visitor does not own', () => {
		applyCircuit(ir('h'), { id: 'someone-elses', name: 'Shared', saved: false });

		expect(get(currentCircuitId)).toBe('someone-elses');
		expect(get(isCircuitSaved)).toBe(false);
	});

	it('carries the published flag for a saved circuit the user owns', () => {
		applyCircuit(ir('h'), { id: 'server-uuid', name: 'Bell', saved: true, isPublic: true });

		expect(get(currentCircuitIsPublic)).toBe(true);
	});

	it('treats anything without an explicit flag as not published', () => {
		currentCircuitIsPublic.set(true);
		// A file import or a handoff: not the visitor's published circuit, so the
		// board must not keep claiming the previous circuit's public state.
		applyCircuit(ir('x'), { name: 'Imported From Elsewhere' });

		expect(get(currentCircuitIsPublic)).toBe(false);
	});

	it('leaves the name alone when none is supplied', () => {
		currentCircuitName.set('Existing Name');
		applyCircuit(ir('h'));
		expect(get(currentCircuitName)).toBe('Existing Name');
	});
});
