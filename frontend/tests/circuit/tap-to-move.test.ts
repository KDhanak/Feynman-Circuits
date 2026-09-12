import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { circuitIR } from '$lib/IR/stores';
import { armedGate } from '$lib/stores/uiStores';
import { armGateForMove, placeArmedGate, disarmGate } from '$lib/circuit/dragDropUtils';
import type { CircuitIR, UnitaryOperation } from '$lib/IR/schema';

function unitary(id: string, gate: string, column: number, targets: number[]): UnitaryOperation {
	return {
		id,
		kind: 'unitary',
		gate: gate as UnitaryOperation['gate'],
		column,
		targets,
		controls: [],
		antiControls: [],
		params: []
	};
}

function setCircuit(operations: UnitaryOperation[], qubits = 3): void {
	const ir: CircuitIR = {
		version: '1.0',
		registers: { q: qubits, c: qubits },
		qubitLabels: Array.from({ length: qubits }, (_, i) => `Qubit ${i}`),
		operations
	};
	circuitIR.set(ir);
}

function opById(id: string) {
	return get(circuitIR).operations.find((o) => o.id === id);
}

describe('tap-to-move (mobile gate relocation)', () => {
	beforeEach(() => {
		disarmGate();
		setCircuit([]);
	});

	it('moves an armed gate to the tapped cell', () => {
		setCircuit([unitary('h1', 'h', 0, [0])]);
		armGateForMove('h1');
		placeArmedGate(3, 2);

		const moved = opById('h1');
		expect(moved?.column).toBe(3);
		expect((moved as UnitaryOperation).targets).toEqual([2]);
	});

	it('disarms after the move, so the next tap does not drag it along', () => {
		setCircuit([unitary('h1', 'h', 0, [0])]);
		armGateForMove('h1');
		placeArmedGate(3, 2);
		expect(get(armedGate)).toBeNull();

		// A second tap elsewhere must not touch the gate.
		placeArmedGate(5, 1);
		expect(opById('h1')?.column).toBe(3);
	});

	it('keeps a palette gate armed so repeated taps place more of it', () => {
		armedGate.set({ source: 'palette', gateType: 'h' });
		placeArmedGate(0, 0);
		expect(get(armedGate)).not.toBeNull();
		placeArmedGate(1, 0);
		expect(get(circuitIR).operations).toHaveLength(2);
	});

	it('refuses to move onto an occupied cell', () => {
		setCircuit([unitary('h1', 'h', 0, [0]), unitary('x1', 'x', 2, [1])]);
		armGateForMove('h1');
		placeArmedGate(2, 1); // occupied by x1

		expect(opById('h1')?.column).toBe(0);
		expect((opById('h1') as UnitaryOperation).targets).toEqual([0]);
	});

	it('moves a SWAP with both of its targets intact', () => {
		setCircuit([unitary('s1', 'swap', 0, [0, 1])]);
		armGateForMove('s1');
		placeArmedGate(4, 0);

		const moved = opById('s1') as UnitaryOperation;
		expect(moved.column).toBe(4);
		expect(moved.targets).toEqual([0, 1]); // both targets move together and stay the same
	});

	it('moves every gate sharing a control dot when the dot itself is armed', () => {
		const controlled = unitary('cx1', 'x', 1, [1]);
		controlled.controls = [0];
		setCircuit([controlled]);

		armGateForMove('cx1', 'CONTROL', 0);
		placeArmedGate(5, 0);

		const moved = opById('cx1') as UnitaryOperation;
		expect(moved.column).toBe(5);
		expect(moved.targets).toEqual([1]); // the target wire is unchanged
		expect(moved.controls).toEqual([0]);
	});

	it('ignores a place with nothing armed', () => {
		setCircuit([unitary('h1', 'h', 0, [0])]);
		placeArmedGate(4, 1);
		expect(opById('h1')?.column).toBe(0);
		expect(get(circuitIR).operations).toHaveLength(1);
	});

	it('expands the register when moved onto the ghost wire', () => {
		setCircuit([unitary('h1', 'h', 0, [0])], 2);
		armGateForMove('h1');
		placeArmedGate(1, 2); // qubit 2 == the ghost wire for a 2-qubit circuit

		expect(get(circuitIR).registers.q).toBe(3);
		expect((opById('h1') as UnitaryOperation).targets).toEqual([2]);
	});
});
