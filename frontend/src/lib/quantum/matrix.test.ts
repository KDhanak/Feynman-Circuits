import { describe, expect, it } from 'vitest';
import {
	applyGate,
	applyMatrix,
	computeMultiControlledUMatrixWithAntiControls,
	extendGateMatrix
} from './matrix';
import { GATE_REGISTRY } from './gates';
import type { Complex } from './complex';

// A random state of n qubits. It does not need to be normalised: both ways of
// applying a gate are linear, so they must agree on any vector.
function randomState(n: number, seed: number): Complex[] {
	let x = seed;
	const rand = () => ((x = (x * 16807) % 2147483647) / 2147483647) * 2 - 1;
	return Array.from({ length: 1 << n }, () => ({ re: rand(), im: rand() }));
}

function expectClose(a: Complex[], b: Complex[]) {
	expect(a).toHaveLength(b.length);
	a.forEach((amp, i) => {
		expect(amp.re).toBeCloseTo(b[i].re, 12);
		expect(amp.im).toBeCloseTo(b[i].im, 12);
	});
}

describe('applyGate gives the same state as the full matrix', () => {
	const n = 4;
	const cases: [string, number[], number, number[], number[]][] = [
		['h', [], 2, [], []],
		['ry', [0.7], 0, [], []],
		['x', [], 3, [1], []],
		['p', [1.1], 1, [0, 3], []],
		['z', [], 0, [2], [3]],
		['rx', [2.3], 3, [], [0, 1]]
	];

	it.each(cases)(
		'%s with params %j on q%i, controls %j, anti-controls %j',
		(gate, params, t, c, a) => {
			const U = GATE_REGISTRY[gate as keyof typeof GATE_REGISTRY].matrix!(params);
			const full =
				c.length || a.length
					? computeMultiControlledUMatrixWithAntiControls(c, a, t, n, U)
					: extendGateMatrix(U, t, n);
			const state = randomState(n, 7 + t);
			expectClose(applyGate(state, U, t, c, a), applyMatrix(full, state));
		}
	);

	it('leaves the input state unchanged', () => {
		const state = randomState(2, 3);
		const copy = state.map((amp) => ({ ...amp }));
		applyGate(state, GATE_REGISTRY.h.matrix!([]), 0);
		expect(state).toEqual(copy);
	});
});
