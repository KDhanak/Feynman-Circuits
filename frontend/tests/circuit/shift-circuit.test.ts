import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Moving every gate one column left or right (the mobile "Move all" buttons).
 * A move must never push a gate off either end of the board, and control dots
 * that are not attached to a gate yet must move with everything else.
 */

vi.mock('$lib/utils/notificationUtils', () => ({ showNotification: vi.fn() }));

import { get } from 'svelte/store';
import { canShiftCircuit, shiftCircuit } from '$lib/circuit/circuitActions';
import { pendingAntiControls, pendingControls } from '$lib/circuit/dragDropUtils';
import { circuitIR } from '$lib/IR/stores';
import type { CircuitIR } from '$lib/IR/schema';
import { MAX_COLUMNS } from '$lib/utils/constants';

function circuitAt(...columns: number[]): CircuitIR {
	return {
		version: '1.0',
		registers: { q: 2, c: 0 },
		qubitLabels: ['Qubit 0', 'Qubit 1'],
		operations: columns.map((column) => ({
			id: crypto.randomUUID(),
			kind: 'unitary',
			gate: 'h',
			column,
			targets: [0],
			controls: [],
			antiControls: [],
			params: []
		}))
	};
}

const columnsOf = () => get(circuitIR).operations.map((op) => op.column);

beforeEach(() => {
	pendingControls.set(new Map());
	pendingAntiControls.set(new Map());
});

describe('shiftCircuit', () => {
	it('moving right moves every gate and leaves the first column empty', () => {
		circuitIR.set(circuitAt(0, 1, 3));
		shiftCircuit(1);
		expect(columnsOf()).toEqual([1, 2, 4]);
	});

	it('moving left moves every gate back one column', () => {
		circuitIR.set(circuitAt(2, 3));
		shiftCircuit(-1);
		expect(columnsOf()).toEqual([1, 2]);
	});

	it('does not move left when the first column has a gate', () => {
		circuitIR.set(circuitAt(0, 2));
		expect(canShiftCircuit(get(circuitIR), -1)).toBe(false);
		shiftCircuit(-1);
		expect(columnsOf()).toEqual([0, 2]);
	});

	it('does not move right when the last column has a gate', () => {
		circuitIR.set(circuitAt(1, MAX_COLUMNS - 1));
		expect(canShiftCircuit(get(circuitIR), 1)).toBe(false);
		shiftCircuit(1);
		expect(columnsOf()).toEqual([1, MAX_COLUMNS - 1]);
	});

	it('cannot move an empty board', () => {
		circuitIR.set(circuitAt());
		expect(canShiftCircuit(get(circuitIR), 1)).toBe(false);
		expect(canShiftCircuit(get(circuitIR), -1)).toBe(false);
	});

	it('moves loose control dots with the gates', () => {
		circuitIR.set(circuitAt(1));
		pendingControls.set(new Map([[4, [1]]]));
		pendingAntiControls.set(new Map([[2, [0]]]));
		shiftCircuit(1);
		expect([...get(pendingControls)]).toEqual([[5, [1]]]);
		expect([...get(pendingAntiControls)]).toEqual([[3, [0]]]);
	});

	it('a loose control dot in the first column blocks moving left', () => {
		circuitIR.set(circuitAt(2));
		pendingControls.set(new Map([[0, [1]]]));
		expect(canShiftCircuit(get(circuitIR), -1)).toBe(false);
	});
});
