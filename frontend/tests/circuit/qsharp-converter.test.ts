import { describe, it, expect } from 'vitest';
import { circuitToQSharp, qsharpToCircuit } from '$lib/circuit/qsharpConverter';
import type { CircuitIR, UnitaryOperation, CircuitOperation } from '$lib/IR/schema';

function makeIR(
	numQubits: number,
	numClassicalBits: number,
	operations: CircuitOperation[]
): CircuitIR {
	return {
		version: '1.0',
		registers: { q: numQubits, c: numClassicalBits },
		qubitLabels: Array.from({ length: numQubits }, (_, i) => `q${i}`),
		operations
	};
}

function unitary(
	gate: UnitaryOperation['gate'],
	column: number,
	targets: number[],
	controls: number[] = [],
	antiControls: number[] = [],
	params: number[] = []
): UnitaryOperation {
	return {
		id: crypto.randomUUID(),
		kind: 'unitary',
		gate,
		column,
		targets,
		controls,
		antiControls,
		params
	};
}

// Just the statements inside the operation, so a test can check one gate
// without repeating the wrapper every time.
function body(ir: CircuitIR): string[] {
	return circuitToQSharp(ir, { includeComments: false })
		.split('\n')
		.slice(2, -2)
		.map((l) => l.trim())
		.filter((l) => l.length > 0 && l !== 'ResetAll(qs);');
}

// Ids are random, so compare everything else. The importer packs gates into
// the earliest free column, so a circuit whose gates were spread one per column
// comes back more tightly packed; stripPlacement compares the gates alone.
function strip(op: CircuitOperation): Omit<CircuitOperation, 'id'> {
	const { id: _id, ...rest } = op;
	return rest;
}

function stripPlacement(op: CircuitOperation): Omit<CircuitOperation, 'id' | 'column'> {
	const { id: _id, column: _column, ...rest } = op;
	return rest;
}

describe('circuitToQSharp', () => {
	it('exports a bell pair with measurement', () => {
		const ir = makeIR(2, 2, [
			unitary('h', 0, [0]),
			unitary('x', 1, [1], [0]),
			{ id: '1', kind: 'measure', gate: 'measure', column: 2, targets: [0], classicalTargets: [0] },
			{ id: '2', kind: 'measure', gate: 'measure', column: 2, targets: [1], classicalTargets: [1] }
		]);

		expect(circuitToQSharp(ir, { includeComments: false })).toBe(
			[
				'operation Main() : Result[] {',
				'    use qs = Qubit[2];',
				'    mutable results = [Zero, size = 2];',
				'',
				'    H(qs[0]);',
				'    CNOT(qs[0], qs[1]);',
				'    set results w/= 0 <- M(qs[0]);',
				'    set results w/= 1 <- M(qs[1]);',
				'',
				'    ResetAll(qs);',
				'    return results;',
				'}'
			].join('\n')
		);
	});

	it('emits operations in column order', () => {
		const ir = makeIR(1, 0, [unitary('t', 2, [0]), unitary('h', 0, [0]), unitary('s', 1, [0])]);
		expect(body(ir)).toEqual(['H(qs[0]);', 'S(qs[0]);', 'T(qs[0]);']);
	});

	it('writes angles as doubles so whole numbers still type-check', () => {
		const ir = makeIR(1, 0, [
			unitary('rx', 0, [0], [], [], [0]),
			unitary('ry', 1, [0], [], [], [Math.PI / 2]),
			unitary('p', 2, [0], [], [], [-1])
		]);
		expect(body(ir)).toEqual([
			'Rx(0.0, qs[0]);',
			'Ry(1.5707963267948966, qs[0]);',
			'R1(-1.0, qs[0]);'
		]);
	});

	it('uses the named intrinsics for CNOT, CCNOT and CZ', () => {
		const ir = makeIR(3, 0, [
			unitary('x', 0, [1], [0]),
			unitary('x', 1, [2], [0, 1]),
			unitary('z', 2, [1], [0])
		]);
		expect(body(ir)).toEqual([
			'CNOT(qs[0], qs[1]);',
			'CCNOT(qs[0], qs[1], qs[2]);',
			'CZ(qs[0], qs[1]);'
		]);
	});

	it('falls back to the Controlled functor, tupling multi-argument gates', () => {
		const ir = makeIR(4, 0, [
			unitary('h', 0, [1], [0]),
			unitary('ry', 1, [3], [0, 1, 2], [], [0.25]),
			unitary('swap', 2, [2, 3], [0])
		]);
		expect(body(ir)).toEqual([
			'Controlled H([qs[0]], qs[1]);',
			'Controlled Ry([qs[0], qs[1], qs[2]], (0.25, qs[3]));',
			'Controlled SWAP([qs[0]], (qs[2], qs[3]));'
		]);
	});

	it('builds anti-controls with an X-sandwich', () => {
		const ir = makeIR(3, 0, [unitary('x', 0, [2], [0], [1])]);
		expect(body(ir)).toEqual(['X(qs[1]);', 'CCNOT(qs[0], qs[1], qs[2]);', 'X(qs[1]);']);
	});

	it('exports swap, reset and barrier', () => {
		const ir = makeIR(2, 0, [
			unitary('swap', 0, [0, 1]),
			{ id: 'r', kind: 'reset', gate: 'reset', column: 1, targets: [0] },
			{ id: 'b', kind: 'barrier', gate: 'barrier', column: 2, targets: [0, 1] }
		]);
		expect(body(ir)).toEqual(['SWAP(qs[0], qs[1]);', 'Reset(qs[0]);', '// barrier qs[0], qs[1]']);
	});

	it('still measures when there is no classical bit to hold the result', () => {
		const ir = makeIR(1, 0, [
			{ id: 'm', kind: 'measure', gate: 'measure', column: 0, targets: [0], classicalTargets: [0] }
		]);
		const code = circuitToQSharp(ir, { includeComments: false });
		expect(code).toContain('operation Main() : Unit {');
		expect(code).toContain('let _ = M(qs[0]);');
		expect(code).not.toContain('mutable results');
	});

	it('resets every qubit before returning', () => {
		const ir = makeIR(2, 0, [unitary('h', 0, [0])]);
		expect(circuitToQSharp(ir, { includeComments: false }).trimEnd().split('\n').at(-2)).toBe(
			'    ResetAll(qs);'
		);
	});

	it('honours the comment and operation name options', () => {
		const ir = makeIR(1, 0, [unitary('h', 0, [0])]);
		expect(circuitToQSharp(ir)).toContain('// Generated by Feynman Circuits');
		expect(circuitToQSharp(ir, { operationName: 'RunCircuit' })).toContain(
			'operation RunCircuit() : Unit {'
		);
	});
});

describe('qsharpToCircuit', () => {
	it('reads back a bell pair exported by circuitToQSharp', () => {
		const original = makeIR(2, 2, [
			unitary('h', 0, [0]),
			unitary('x', 1, [1], [0]),
			{ id: '1', kind: 'measure', gate: 'measure', column: 2, targets: [0], classicalTargets: [0] },
			{ id: '2', kind: 'measure', gate: 'measure', column: 2, targets: [1], classicalTargets: [1] }
		]);

		const back = qsharpToCircuit(circuitToQSharp(original));
		expect(back).not.toBeNull();
		expect(back!.registers).toEqual({ q: 2, c: 2 });
		expect(back!.operations.map(strip)).toEqual(original.operations.map(strip));
	});

	it('round-trips gates, controls, angles, swap, reset and barrier', () => {
		const original = makeIR(4, 0, [
			unitary('rx', 0, [0], [], [], [Math.PI / 2]),
			unitary('t', 1, [2]),
			unitary('swap', 2, [0, 1]),
			unitary('z', 3, [3], [0]),
			unitary('x', 4, [3], [0, 1]),
			unitary('ry', 5, [3], [0, 1, 2], [], [0.25]),
			unitary('swap', 6, [2, 3], [0]),
			{ id: 'b', kind: 'barrier', gate: 'barrier', column: 7, targets: [0, 1] },
			{ id: 'r', kind: 'reset', gate: 'reset', column: 8, targets: [2] }
		]);

		const back = qsharpToCircuit(circuitToQSharp(original));
		expect(back).not.toBeNull();
		expect(back!.operations.map(stripPlacement)).toEqual(original.operations.map(stripPlacement));
	});

	it('reads hand-written Q# using single qubits, CX and PI()', () => {
		const back = qsharpToCircuit(`
			operation Prepare() : Unit {
				use control = Qubit();
				use target = Qubit();

				H(control);
				CX(control, target);
				Rz(PI() / 2.0, target);
				Reset(target);
			}
		`);

		expect(back).not.toBeNull();
		expect(back!.registers.q).toBe(2);
		expect(back!.operations.map(strip)).toEqual([
			strip(unitary('h', 0, [0])),
			strip(unitary('x', 1, [1], [0])),
			strip(unitary('rz', 2, [1], [], [], [Math.PI / 2])),
			{ kind: 'reset', gate: 'reset', column: 3, targets: [1] }
		]);
	});

	it('splits MResetZ into a measurement and a reset', () => {
		const back = qsharpToCircuit(
			[
				'use qs = Qubit[1];',
				'mutable results = [Zero, size = 1];',
				'set results w/= 0 <- MResetZ(qs[0]);'
			].join('\n')
		);

		expect(back!.operations.map((op) => op.kind)).toEqual(['measure', 'reset']);
	});

	it('ignores the trailing ResetAll but keeps a mid-circuit Reset', () => {
		const back = qsharpToCircuit(
			['use qs = Qubit[2];', 'H(qs[0]);', 'Reset(qs[0]);', 'ResetAll(qs);'].join('\n')
		);

		expect(back!.operations.map((op) => op.kind)).toEqual(['unitary', 'reset']);
	});

	it('grows the classical register to fit a measurement it was not declared for', () => {
		const back = qsharpToCircuit(
			[
				'use qs = Qubit[1];',
				'mutable results = [Zero, size = 1];',
				'set results w/= 3 <- M(qs[0]);'
			].join('\n')
		);

		expect(back!.registers.c).toBe(4);
	});

	it('packs statements into columns so independent gates share one', () => {
		const back = qsharpToCircuit(
			['use qs = Qubit[2];', 'H(qs[0]);', 'X(qs[1]);', 'CNOT(qs[0], qs[1]);'].join('\n')
		);

		expect(back!.operations.map((op) => op.column)).toEqual([0, 0, 1]);
	});

	it('returns null when there is no qubit declaration', () => {
		expect(qsharpToCircuit('operation Main() : Unit { }')).toBeNull();
		expect(qsharpToCircuit('not q# at all')).toBeNull();
	});
});
