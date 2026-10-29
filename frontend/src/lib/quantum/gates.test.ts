import { describe, expect, it } from 'vitest';
import { type Complex, createComplex } from './complex';
import { GATE_REGISTRY, UNITARY_GATE_IDS } from './gates';

// The tooltip matrices are hand-written text. These tests read that text back
// into numbers and compare it with the matrix the simulator really uses, so a
// tooltip can never show a different gate from the one that runs.

const THETA = 0.7; // any angle that isn't a special value works

const expi = (a: number) => createComplex(Math.cos(a), Math.sin(a));
const c = Math.cos(THETA / 2);
const s = Math.sin(THETA / 2);

// Every entry the tooltips use, and its value at THETA.
const ENTRY_VALUES: Record<string, Complex> = {
	'0': createComplex(0, 0),
	'1': createComplex(1, 0),
	'−1': createComplex(-1, 0),
	i: createComplex(0, 1),
	'−i': createComplex(0, -1),
	'e^{iπ/4}': expi(Math.PI / 4),
	'e^{iθ}': expi(THETA),
	'e^{iθ/2}': expi(THETA / 2),
	'e^{−iθ/2}': expi(-THETA / 2),
	'cos(θ/2)': createComplex(c, 0),
	'sin(θ/2)': createComplex(s, 0),
	'−sin(θ/2)': createComplex(-s, 0),
	'−i sin(θ/2)': createComplex(0, -s)
};
const SCALE_VALUES: Record<string, number> = { '1/√2': 1 / Math.sqrt(2) };

// SWAP has no matrix function (the simulator swaps amplitudes directly), so
// its matrix is written out here.
const SWAP_MATRIX = [
	[1, 0, 0, 0],
	[0, 0, 1, 0],
	[0, 1, 0, 0],
	[0, 0, 0, 1]
].map((row) => row.map((v) => createComplex(v, 0)));

describe('gate tooltip matrices', () => {
	it.each(UNITARY_GATE_IDS)('%s tooltip matches the real matrix', (id) => {
		const spec = GATE_REGISTRY[id];
		const real = spec.matrix ? spec.matrix([THETA]) : SWAP_MATRIX;
		const { scale, rows } = spec.tooltip.matrix;
		const k = scale ? SCALE_VALUES[scale] : 1;
		expect(k, `unknown scale "${scale}"`).toBeDefined();

		expect(rows.length).toBe(real.length);
		rows.forEach((row, r) => {
			expect(row.length).toBe(real[r].length);
			row.forEach((entry, col) => {
				const value = ENTRY_VALUES[entry];
				expect(value, `unknown entry "${entry}"`).toBeDefined();
				expect(value.re * k).toBeCloseTo(real[r][col].re, 10);
				expect(value.im * k).toBeCloseTo(real[r][col].im, 10);
			});
		});
	});
});
