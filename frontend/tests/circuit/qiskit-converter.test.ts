import { describe, it, expect } from 'vitest';
import { circuitToQiskit, qiskitToCircuit } from '$lib/circuit/qiskitConverter';
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

describe('circuitToQiskit', () => {
	it('exports a bell pair with measurement', () => {
		const ir = makeIR(2, 2, [
			unitary('h', 0, [0]),
			unitary('x', 1, [1], [0]),
			{ id: '1', kind: 'measure', gate: 'measure', column: 2, targets: [0], classicalTargets: [0] },
			{ id: '2', kind: 'measure', gate: 'measure', column: 2, targets: [1], classicalTargets: [1] }
		]);

		expect(circuitToQiskit(ir, { includeComments: false })).toBe(
			[
				'from qiskit import QuantumCircuit',
				'',
				'circuit = QuantumCircuit(2, 2)',
				'',
				'circuit.h(0)',
				'circuit.cx(0, 1)',
				'circuit.measure(0, 0)',
				'circuit.measure(1, 1)'
			].join('\n')
		);
	});

	it('omits the classical register when there are no classical bits', () => {
		const ir = makeIR(1, 0, [unitary('x', 0, [0])]);
		expect(circuitToQiskit(ir, { includeComments: false })).toContain(
			'circuit = QuantumCircuit(1)'
		);
	});

	it('uses named controlled methods where Qiskit has them', () => {
		const ir = makeIR(3, 0, [
			unitary('z', 0, [1], [0]),
			unitary('x', 1, [2], [0, 1]),
			unitary('rx', 2, [1], [0], [], [Math.PI / 2]),
			unitary('swap', 3, [1, 2], [0])
		]);
		const py = circuitToQiskit(ir, { includeComments: false });
		expect(py).toContain('circuit.cz(0, 1)');
		expect(py).toContain('circuit.ccx(0, 1, 2)');
		expect(py).toContain(`circuit.crx(${Math.PI / 2}, 0, 1)`);
		expect(py).toContain('circuit.cswap(0, 1, 2)');
	});

	it('falls back to the append form for controlled gates without a named method', () => {
		const ir = makeIR(3, 0, [
			unitary('t', 0, [1], [0]),
			unitary('ry', 1, [2], [0, 1], [], [Math.PI])
		]);
		const py = circuitToQiskit(ir, { includeComments: false });
		expect(py).toContain('from qiskit.circuit.library import RYGate, TGate');
		expect(py).toContain('circuit.append(TGate().control(1), [0, 1])');
		expect(py).toContain(`circuit.append(RYGate(${Math.PI}).control(2), [0, 1, 2])`);
	});

	it('wraps anti-controls in an X-sandwich', () => {
		const ir = makeIR(2, 0, [unitary('x', 0, [1], [], [0])]);
		expect(circuitToQiskit(ir, { includeComments: false })).toContain(
			['circuit.x(0)', 'circuit.cx(0, 1)', 'circuit.x(0)'].join('\n')
		);
	});

	it('exports reset and barrier', () => {
		const ir = makeIR(2, 0, [
			{ id: '1', kind: 'reset', gate: 'reset', column: 0, targets: [0] },
			{ id: '2', kind: 'barrier', gate: 'barrier', column: 1, targets: [0, 1] }
		]);
		const py = circuitToQiskit(ir, { includeComments: false });
		expect(py).toContain('circuit.reset(0)');
		expect(py).toContain('circuit.barrier(0, 1)');
	});
});

describe('qiskitToCircuit', () => {
	it('parses a hand-written qiskit script', () => {
		const py = `
from qiskit import QuantumCircuit
import numpy as np

circuit = QuantumCircuit(3, 3)  # three qubits
circuit.h(0)
circuit.cx(0, 1)
circuit.rx(np.pi / 2, 2)
circuit.crz(pi/4, 0, 2)
circuit.barrier()
circuit.measure(0, 0)
`;
		const ir = qiskitToCircuit(py);
		expect(ir).not.toBeNull();
		expect(ir!.registers).toEqual({ q: 3, c: 3 });

		const gates = ir!.operations.map((op) => op.gate);
		expect(gates).toEqual(['h', 'x', 'rx', 'rz', 'barrier', 'measure']);

		const rx = ir!.operations[2] as UnitaryOperation;
		expect(rx.params[0]).toBeCloseTo(Math.PI / 2);
		const crz = ir!.operations[3] as UnitaryOperation;
		expect(crz.controls).toEqual([0]);
		expect(crz.targets).toEqual([2]);
		expect(crz.params[0]).toBeCloseTo(Math.PI / 4);

		const barrier = ir!.operations[4];
		expect(barrier.kind).toBe('barrier');
		expect((barrier as { targets: number[] }).targets).toEqual([0, 1, 2]);
	});

	it('expands measure_all into per-qubit measurements', () => {
		const ir = qiskitToCircuit('qc = QuantumCircuit(2)\nqc.h(0)\nqc.measure_all()');
		expect(ir).not.toBeNull();
		expect(ir!.registers.c).toBe(2);
		const measures = ir!.operations.filter((op) => op.kind === 'measure');
		expect(measures).toHaveLength(2);
	});

	it('parses the append form back into controlled gates', () => {
		const ir = qiskitToCircuit(
			'qc = QuantumCircuit(3)\nqc.append(TGate().control(1), [0, 1])\nqc.append(RYGate(pi).control(2), [0, 1, 2])'
		);
		expect(ir).not.toBeNull();
		const [t, ry] = ir!.operations as UnitaryOperation[];
		expect(t.gate).toBe('t');
		expect(t.controls).toEqual([0]);
		expect(t.targets).toEqual([1]);
		expect(ry.gate).toBe('ry');
		expect(ry.controls).toEqual([0, 1]);
		expect(ry.targets).toEqual([2]);
		expect(ry.params[0]).toBeCloseTo(Math.PI);
	});

	it('returns null when no QuantumCircuit declaration is present', () => {
		expect(qiskitToCircuit('print("hello")')).toBeNull();
	});

	it('parses IBM Quantum Composer register-based output', () => {
		const py = `
from qiskit import QuantumRegister, ClassicalRegister, QuantumCircuit
from numpy import pi

qreg_q = QuantumRegister(2, 'q')

circuit = QuantumCircuit(qreg_q)

circuit.h(qreg_q[0])
circuit.cx(qreg_q[0], qreg_q[1])
circuit.h(qreg_q[0])
`;
		const ir = qiskitToCircuit(py);
		expect(ir).not.toBeNull();
		expect(ir!.registers).toEqual({ q: 2, c: 0 });

		const gates = ir!.operations.map((op) => op.gate);
		expect(gates).toEqual(['h', 'x', 'h']);

		const cx = ir!.operations[1] as UnitaryOperation;
		expect(cx.controls).toEqual([0]);
		expect(cx.targets).toEqual([1]);
	});

	it('resolves register-indexed measurement with an explicit classical register', () => {
		const py = `
qreg_q = QuantumRegister(2, 'q')
creg_c = ClassicalRegister(2, 'c')
circuit = QuantumCircuit(qreg_q, creg_c)
circuit.h(qreg_q[0])
circuit.measure(qreg_q[1], creg_c[1])
`;
		const ir = qiskitToCircuit(py);
		expect(ir).not.toBeNull();
		expect(ir!.registers).toEqual({ q: 2, c: 2 });
		const measure = ir!.operations[1];
		expect(measure.kind).toBe('measure');
		expect((measure as { targets: number[] }).targets).toEqual([1]);
		expect((measure as { classicalTargets: number[] }).classicalTargets).toEqual([1]);
	});

	it('offsets flat indices across multiple quantum registers', () => {
		const py = `
qreg_a = QuantumRegister(2, 'a')
qreg_b = QuantumRegister(2, 'b')
circuit = QuantumCircuit(qreg_a, qreg_b)
circuit.cx(qreg_a[1], qreg_b[0])
`;
		const ir = qiskitToCircuit(py);
		expect(ir).not.toBeNull();
		expect(ir!.registers.q).toBe(4);
		const cx = ir!.operations[0] as UnitaryOperation;
		// qreg_a[1] -> 1, qreg_b[0] -> 2 (offset past qreg_a's 2 qubits)
		expect(cx.controls).toEqual([1]);
		expect(cx.targets).toEqual([2]);
	});

	it('assigns columns so gates on the same qubit do not collide', () => {
		const ir = qiskitToCircuit('qc = QuantumCircuit(2)\nqc.h(0)\nqc.cx(0, 1)\nqc.x(1)');
		expect(ir).not.toBeNull();
		const [h, cx, x] = ir!.operations;
		expect(h.column).toBe(0);
		expect(cx.column).toBe(1);
		expect(x.column).toBe(2);
	});
});

describe('round trip', () => {
	it('preserves the circuit through export and re-import', () => {
		const ir = makeIR(3, 2, [
			unitary('h', 0, [0]),
			unitary('x', 1, [1], [0]),
			unitary('rz', 2, [2], [], [], [Math.PI / 3]),
			unitary('t', 3, [1], [2]),
			unitary('swap', 4, [0, 1]),
			{ id: 'm', kind: 'measure', gate: 'measure', column: 5, targets: [0], classicalTargets: [1] },
			{ id: 'r', kind: 'reset', gate: 'reset', column: 5, targets: [2] }
		]);

		const roundTripped = qiskitToCircuit(circuitToQiskit(ir));
		expect(roundTripped).not.toBeNull();
		expect(roundTripped!.registers).toEqual(ir.registers);

		// The importer re-packs columns (ASAP scheduling, like the QASM importer),
		// so compare everything except id and column.
		const stripped = (ops: CircuitOperation[]) =>
			ops.map(({ id: _id, column: _column, ...rest }) => rest);
		expect(stripped(roundTripped!.operations)).toEqual(stripped(ir.operations));
	});
});
