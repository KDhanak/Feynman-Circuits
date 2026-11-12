import { describe, expect, it } from 'vitest';
import { phaseColor, qspherePoints } from './qsphere';
import { simulateMultipleQubits } from '../circuit/simulator';
import { EXAMPLES, exampleCircuit } from '$lib/examples';
import type { Complex } from './complex';

const c = (re: number, im = 0): Complex => ({ re, im });
const s = Math.SQRT1_2;

describe('qspherePoints', () => {
	it('puts a Bell pair at the two poles, one dot each', () => {
		const points = qspherePoints([c(s), c(0), c(0), c(s)]);
		expect(points.map((p) => p.index)).toEqual([0, 3]);
		expect(points[0]).toMatchObject({ z: 1, phase: 0 });
		expect(points[1]).toMatchObject({ z: -1, phase: 0 });
		for (const p of points) expect(p.probability).toBeCloseTo(0.5, 12);
	});

	it('puts states with the same number of 1s on one ring, spread evenly', () => {
		// |001⟩, |010⟩, |100⟩ on 3 qubits: all one 1, so all at z = 1/3.
		const state = Array.from({ length: 8 }, (_, i) =>
			c([1, 2, 4].includes(i) ? 1 / Math.sqrt(3) : 0)
		);
		const points = qspherePoints(state);
		expect(points).toHaveLength(3);
		for (const p of points) {
			expect(p.z).toBeCloseTo(1 / 3, 12);
			expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 12);
		}
		// Evenly spread: the three are 120° apart.
		const angles = points.map((p) => Math.atan2(p.y, p.x));
		const gap = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
		expect(gap(angles[0], angles[1])).toBeCloseTo((2 * Math.PI) / 3, 12);
		expect(gap(angles[1], angles[2])).toBeCloseTo((2 * Math.PI) / 3, 12);
	});

	it('ignores a global phase', () => {
		const i = { re: 0, im: s }; // i/√2: the same Bell pair, times i
		expect(qspherePoints([i, c(0), c(0), i]).map((p) => p.phase)).toEqual([0, 0]);
	});

	it('shows a relative phase, measured from the most likely state', () => {
		// (|00⟩ − |11⟩)/√2: the second dot is half a turn from the first.
		const points = qspherePoints([c(s), c(0), c(0), c(-s)]);
		expect(points.map((p) => p.phase)).toEqual([0, Math.PI]);
	});

	it('shows how the Grover oracle marks 11 by its phase alone', () => {
		// After H on both and the oracle (column 1), all four states are equally
		// likely, and only 11 has the opposite phase.
		const grover = exampleCircuit(EXAMPLES.find((e) => e.id === 'grover')!);
		const afterOracle = simulateMultipleQubits(grover).steps!.find((st) => st.column === 1)!.after;
		const points = qspherePoints(afterOracle);
		expect(points.map((p) => p.probability.toFixed(2))).toEqual(['0.25', '0.25', '0.25', '0.25']);
		expect(points.map((p) => p.phase)).toEqual([0, 0, 0, Math.PI]);
	});

	it('leaves out states too unlikely to see', () => {
		expect(qspherePoints([c(1), c(1e-5)])).toHaveLength(1);
	});
});

describe('phaseColor', () => {
	it('gives opposite phases opposite hues, and treats −π like π', () => {
		expect(phaseColor(0)).toBe('hsl(265 75% 55%)');
		expect(phaseColor(Math.PI)).toBe('hsl(85 75% 55%)');
		expect(phaseColor(-Math.PI)).toBe(phaseColor(Math.PI));
	});
});
