import { describe, expect, it } from 'vitest';
import type { CircuitIR, CircuitOperation, UnitaryOperation } from '../IR/schema';
import { applyMatrix } from '../quantum/matrix';
import { magnitudeSquared } from '../quantum/complex';
import { simulateMultipleQubits } from './simulator';
import { formatAmplitude, ketTerms, operatorLine, describeOperation } from './steps';

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
