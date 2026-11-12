import { describe, expect, it } from 'vitest';
import type { CircuitIR, CircuitOperation, UnitaryOperation } from '../IR/schema';
import { applyMatrix } from '../quantum/matrix';
import { magnitudeSquared } from '../quantum/complex';
import { simulateMultipleQubits } from './simulator';
import {
	formatAmplitude,
	ketTerms,
	operatorLine,
	operatorFactors,
	describeOperation,
	type OperatorFactor
} from './steps';
import type { Complex } from '../quantum/complex';

function gate(
	id: string,
	g: UnitaryOperation['gate'],
	column: number,
	targets: number[],
	extra: Partial<UnitaryOperation> = {}
): UnitaryOperation {
	return {
		id,
		kind: 'unitary',
		gate: g,
		column,
		targets,
		controls: [],
		antiControls: [],
		params: [],
		...extra
	};
}

function circuit(q: number, operations: CircuitOperation[]): CircuitIR {
	return {
		version: '1.0',
		registers: { q, c: q },
		qubitLabels: Array.from({ length: q }, (_, i) => `Qubit ${i}`),
		operations
	};
}

// H on q0, then CNOT q0 → q1: the Bell pair (|00⟩ + |11⟩)/√2.
const bell = circuit(2, [gate('h', 'h', 0, [0]), gate('cx', 'x', 1, [1], { controls: [0] })]);

describe('simulation steps', () => {
	it('records one step per used column, chained together', () => {
		const { steps = [] } = simulateMultipleQubits(bell);
		expect(steps.map((s) => s.column)).toEqual([0, 1]);
		expect(steps[1].before).toEqual(steps[0].after);
	});

	it('the column matrix times the state before gives the state after', () => {
		const { steps = [] } = simulateMultipleQubits(bell);
		for (const step of steps) {
			const result = applyMatrix(step.matrix!, step.before);
			result.forEach((amp, i) => {
				expect(amp.re).toBeCloseTo(step.after[i].re, 10);
				expect(amp.im).toBeCloseTo(step.after[i].im, 10);
			});
		}
	});

	it('includes SWAP in the column matrix', () => {
		const ir = circuit(2, [gate('x', 'x', 0, [0]), gate('sw', 'swap', 1, [0, 1])]);
		const { steps = [] } = simulateMultipleQubits(ir);
		const swapStep = steps[1];
		const result = applyMatrix(swapStep.matrix!, swapStep.before);
		expect(magnitudeSquared(result[2])).toBeCloseTo(1, 10); // |10⟩: q1 = 1
	});

	it('has no column matrix for a measurement, and records Born probabilities', () => {
		const ir = circuit(1, [
			gate('h', 'h', 0, [0]),
			{ id: 'm', kind: 'measure', gate: 'measure', column: 1, targets: [0], classicalTargets: [0] }
		]);
		const { steps = [] } = simulateMultipleQubits(ir);
		expect(steps[1].matrix).toBeNull();
		expect(steps[1].measurements[0].prob0).toBeCloseTo(0.5, 10);
	});

	it('leaves out the full matrix above the size limit', () => {
		const ir = circuit(4, [gate('h', 'h', 0, [0])]);
		const { steps = [] } = simulateMultipleQubits(ir);
		expect(steps[0].matrix).toBeNull();
	});
});

describe('step text', () => {
	const { steps = [] } = simulateMultipleQubits(bell);

	it('writes the column as a tensor product, in bit order', () => {
		expect(operatorLine(steps[0].ops, 2, 'q0-right')).toBe('I ⊗ H');
		expect(operatorLine(steps[0].ops, 2, 'q0-left')).toBe('H ⊗ I');
		expect(operatorLine(steps[1].ops, 2, 'q0-right')).toBe('CX(q0 → q1)');
	});

	it('joins single-qubit gates and controlled gates in one column', () => {
		const ir = circuit(3, [gate('h', 'h', 0, [2]), gate('cx', 'x', 0, [1], { controls: [0] })]);
		const { steps: s = [] } = simulateMultipleQubits(ir);
		expect(operatorLine(s[0].ops, 3, 'q0-right')).toBe('(H ⊗ I ⊗ I) · CX(q0 → q1)');
	});

	it('describes controlled gates in words', () => {
		expect(describeOperation(steps[1].ops[0].op)).toBe('X on q1, only when q0 = 1');
	});

	it('lists the kets of the Bell state', () => {
		const terms = ketTerms(steps[1].after, 2, 'q0-right', steps[1].before);
		expect(terms.map((t) => `${t.coefficient}|${t.label}⟩`)).toEqual(['0.707|00⟩', '0.707|11⟩']);
		expect(terms.map((t) => t.changed)).toEqual([false, true]);
	});

	it('formats amplitudes briefly', () => {
		expect(formatAmplitude({ re: 0, im: 0 })).toBe('0');
		expect(formatAmplitude({ re: -0.5, im: 0 })).toBe('−0.5');
		expect(formatAmplitude({ re: 0, im: -1 })).toBe('−i');
		expect(formatAmplitude({ re: 0.5, im: -0.5 })).toBe('0.5−0.5i');
	});
});

describe('operator factors', () => {
	const mul = (a: Complex, b: Complex): Complex => ({
		re: a.re * b.re - a.im * b.im,
		im: a.re * b.im + a.im * b.re
	});

	// Builds a factor's matrix up to the whole register: for each basis state,
	// read the factor's own qubits, look up its entry, and keep the other
	// qubits as they are. Then the factors are multiplied together.
	function fullMatrix(factors: OperatorFactor[], n: number): Complex[][] {
		const dim = 1 << n;
		let total: Complex[][] = Array.from({ length: dim }, (_, r) =>
			Array.from({ length: dim }, (_, c) => ({ re: r === c ? 1 : 0, im: 0 }))
		);
		for (const f of factors) {
			const qs = [...f.qubits].sort((a, b) => a - b);
			const local = (i: number) => qs.reduce((v, q, j) => v | (((i >> q) & 1) << j), 0);
			const rest = (i: number) => qs.reduce((v, q) => v & ~(1 << q), i);
			const big = Array.from({ length: dim }, (_, r) =>
				Array.from({ length: dim }, (_, c) =>
					rest(r) === rest(c) ? f.matrix![local(r)][local(c)] : { re: 0, im: 0 }
				)
			);
			total = big.map((row) =>
				total[0].map((_, c) =>
					row.reduce(
						(s, v, k) => {
							const p = mul(v, total[k][c]);
							return { re: s.re + p.re, im: s.im + p.im };
						},
						{ re: 0, im: 0 }
					)
				)
			);
		}
		return total;
	}

	// Columns that mix single-qubit gates, controls on either side of the
	// target, an anti-control and a SWAP.
	const cases: [string, CircuitIR][] = [
		['Bell CNOT', bell],
		[
			'H with a CNOT whose control is below its target',
			circuit(3, [gate('h', 'h', 0, [0]), gate('cx', 'x', 0, [1], { controls: [2] })])
		],
		[
			'controlled phase and an anti-controlled RY',
			circuit(3, [
				gate('h', 'h', 0, [0]),
				gate('cp', 'p', 1, [0], { controls: [2], params: [Math.PI / 4] }),
				gate('ary', 'ry', 2, [2], { antiControls: [1], params: [1.1] })
			])
		],
		['SWAP next to S', circuit(3, [gate('s', 's', 0, [1]), gate('sw', 'swap', 0, [0, 2])])],
		['Toffoli', circuit(3, [gate('ccx', 'x', 0, [2], { controls: [0, 1] })])]
	];

	it.each(cases)('%s: the factors multiply to the full matrix', (_, ir) => {
		const n = ir.registers.q;
		for (const step of simulateMultipleQubits(ir).steps ?? []) {
			for (const order of ['q0-right', 'q0-left'] as const) {
				const { tensor, products } = operatorFactors(step.ops, n, order);
				const built = fullMatrix([...tensor, ...products], n);
				step.matrix!.forEach((row, r) =>
					row.forEach((v, c) => {
						expect(built[r][c].re).toBeCloseTo(v.re);
						expect(built[r][c].im).toBeCloseTo(v.im);
					})
				);
			}
		}
	});

	it('gives a CNOT its 4×4 on its own two qubits, and I on idle wires', () => {
		const ir = circuit(5, [gate('h', 'h', 0, [4]), gate('cx', 'x', 0, [3], { controls: [1] })]);
		const [step] = simulateMultipleQubits(ir).steps!;
		const { tensor, products } = operatorFactors(step.ops, 5, 'q0-right');
		expect(tensor.map((f) => f.label)).toEqual(['H', 'I', 'I', 'I', 'I']);
		expect(products[0].label).toBe('CX(q1 → q3)');
		expect(products[0].qubits).toEqual([3, 1]);
		// q1 is the lower bit: |q3 q1⟩ = |01⟩ (index 1) goes to |11⟩ (index 3).
		expect(products[0].matrix!.map((row) => row.map((v) => v.re))).toEqual([
			[1, 0, 0, 0],
			[0, 0, 0, 1],
			[0, 0, 1, 0],
			[0, 1, 0, 0]
		]);
	});

	it('leaves out the matrix of a factor on more than 3 qubits', () => {
		const ir = circuit(5, [gate('c3x', 'x', 0, [4], { controls: [0, 1, 2] })]);
		const [step] = simulateMultipleQubits(ir).steps!;
		const { products } = operatorFactors(step.ops, 5, 'q0-right');
		expect(products[0].matrix).toBeNull();
	});
});
