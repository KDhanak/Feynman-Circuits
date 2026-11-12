import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

// These actions re-run the simulation and show toasts. Neither matters here.
vi.mock('$lib/circuit/dragDropUtils', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/circuit/dragDropUtils')>()),
	triggerSimulation: vi.fn()
}));
vi.mock('../utils/notificationUtils', () => ({ showNotification: vi.fn() }));

import type { CircuitIR, UnitaryOperation } from '../IR/schema';
import { circuitIR } from '../IR/stores';
import { validateCanonicalIR } from '../IR/validate';
import { selectedGateIds } from './selection';
import { createZoneFromSelection, layoutZoneTags, removeZone, renameZone } from './zones';
import { compactCircuit, shiftCircuit } from './circuitActions';
import { EXAMPLES, exampleCircuit } from '$lib/examples';

const h = (id: string, column: number, target = 0): UnitaryOperation => ({
	id,
	kind: 'unitary',
	gate: 'h',
	column,
	targets: [target],
	controls: [],
	antiControls: [],
	params: []
});

const board = (operations: UnitaryOperation[], zones?: CircuitIR['zones']): CircuitIR => ({
	version: '1.0',
	registers: { q: 2, c: 2 },
	qubitLabels: ['Qubit 0', 'Qubit 1'],
	operations,
	...(zones && { zones })
});

const zone = (id: string, startColumn: number, endColumn: number, name = id) => ({
	id,
	name,
	startColumn,
	endColumn
});

describe('zone validation', () => {
	it('accepts a circuit with no zones, or with separate zones', () => {
		expect(validateCanonicalIR(board([])).valid).toBe(true);
		expect(validateCanonicalIR(board([], [zone('a', 0, 1), zone('b', 2, 4)])).valid).toBe(true);
	});

	it.each([
		['overlapping zones', [zone('a', 0, 2), zone('b', 2, 3)]],
		['a backwards range', [zone('a', 3, 1)]],
		['a repeated id', [zone('a', 0, 0), zone('a', 1, 1)]],
		['a name over 40 characters', [zone('a', 0, 0, 'x'.repeat(41))]]
	])('rejects %s', (_, zones) => {
		expect(validateCanonicalIR(board([], zones)).valid).toBe(false);
	});
});

describe('zone actions', () => {
	beforeEach(() => {
		circuitIR.set(board([h('a', 0), h('b', 2), h('c', 4)]));
		selectedGateIds.set(new Set());
	});

	it('makes a zone from the first to the last selected column', () => {
		selectedGateIds.set(new Set(['a', 'b']));
		const id = createZoneFromSelection();
		expect(get(circuitIR).zones).toEqual([{ id, name: 'Zone 1', startColumn: 0, endColumn: 2 }]);
		expect(get(selectedGateIds).size).toBe(0);
	});

	it('makes no zone without a selection, or over another zone', () => {
		expect(createZoneFromSelection()).toBeNull();
		selectedGateIds.set(new Set(['a', 'b']));
		createZoneFromSelection();
		selectedGateIds.set(new Set(['b', 'c']));
		expect(createZoneFromSelection()).toBeNull();
		expect(get(circuitIR).zones).toHaveLength(1);
	});

	it('renames and removes a zone, leaving the gates alone', () => {
		selectedGateIds.set(new Set(['a']));
		const id = createZoneFromSelection()!;
		renameZone(id, '  Oracle  ');
		expect(get(circuitIR).zones?.[0].name).toBe('Oracle');
		removeZone(id);
		expect(get(circuitIR).zones).toBeUndefined();
		expect(get(circuitIR).operations).toHaveLength(3);
	});
});

describe('zones move with the circuit', () => {
	it('shifts zones with "Move all"', () => {
		circuitIR.set(board([h('a', 1)], [zone('z', 1, 1)]));
		shiftCircuit(1);
		expect(get(circuitIR).zones?.[0]).toMatchObject({ startColumn: 2, endColumn: 2 });
	});

	it('does not move a zone off the board', () => {
		// The gate could move left, but the zone already starts at column 0.
		circuitIR.set(board([h('a', 1)], [zone('z', 0, 1)]));
		shiftCircuit(-1);
		expect(get(circuitIR).operations[0].column).toBe(1);
	});

	it('compacts inside each zone, without moving a gate into an earlier zone', () => {
		// Two gates on different qubits. Without zones, compacting would put both
		// in column 0. With a zone each, the second must stay after the first.
		circuitIR.set(board([h('a', 1, 0), h('b', 5, 1)], [zone('first', 0, 2), zone('second', 4, 6)]));
		compactCircuit();
		const ir = get(circuitIR);
		expect(ir.operations.map((op) => op.column)).toEqual([0, 1]);
		expect(ir.zones).toEqual([zone('first', 0, 0), zone('second', 1, 1)]);
	});

	it('compacts exactly as before when there are no zones', () => {
		circuitIR.set(board([h('a', 1, 0), h('b', 5, 1)]));
		compactCircuit();
		expect(get(circuitIR).operations.map((op) => op.column)).toEqual([0, 0]);
		expect(get(circuitIR).zones).toBeUndefined();
	});
});

it('the Grover example opens with its three zones', () => {
	const grover = exampleCircuit(EXAMPLES.find((e) => e.id === 'grover')!);
	expect(validateCanonicalIR(grover).valid).toBe(true);
	expect(grover.zones?.map((z) => z.name)).toEqual([
		'Superposition',
		'Oracle: marks 11',
		'Diffuser: amplifies 11'
	]);
	// Every gate sits inside a zone.
	for (const op of grover.operations) {
		expect(grover.zones?.some((z) => z.startColumn <= op.column && op.column <= z.endColumn)).toBe(
			true
		);
	}
});

describe('zone name tags', () => {
	it('puts a tag on a second row only when it would run into the one before', () => {
		const zones = [zone('s', 0, 0), zone('o', 1, 1), zone('d', 2, 6), zone('far', 10, 10)];
		// Every tag 100px wide, columns 56px: 's' ends at 100, so 'o' (left 56)
		// moves down; 'd' (left 112) fits on the first row again.
		const { row, rows } = layoutZoneTags(zones, 56, () => 100);
		expect([...row.values()]).toEqual([0, 1, 0, 0]);
		expect(rows).toBe(2);
	});
});
