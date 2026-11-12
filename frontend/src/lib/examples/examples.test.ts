import { describe, expect, it } from 'vitest';
import { EXAMPLES, exampleCircuit, type ExampleId } from './index';
import { simulateMultipleQubits } from '$lib/circuit/simulator';
import { importCircuit } from '$lib/circuit/IE';

const run = (id: ExampleId) => {
	const example = EXAMPLES.find((e) => e.id === id)!;
	return simulateMultipleQubits(exampleCircuit(example));
};

// Labels are as the simulator writes them: q0 is the rightmost bit.
function expectProbabilities(id: ExampleId, expected: Record<string, number>) {
	const { probabilities } = run(id);
	for (const basis of new Set([...Object.keys(probabilities), ...Object.keys(expected)])) {
		expect(probabilities[basis] ?? 0, basis).toBeCloseTo(expected[basis] ?? 0);
	}
}

describe('examples', () => {
	it.each(EXAMPLES.map((e) => [e.id, e] as const))('%s is a valid circuit', (_, example) => {
		expect(importCircuit(exampleCircuit(example)).ok).toBe(true);
	});

	it('GHZ-3 gives 000 or 111, half the time each', () => {
		expectProbabilities('ghz3', { '000': 0.5, '111': 0.5 });
	});

	it('superdense coding delivers the message 11', () => {
		expectProbabilities('superdense', { '11': 1 });
	});

	it('Deutsch–Jozsa finds the balanced function: q0 ends at 1', () => {
		expectProbabilities('deutsch-jozsa', { '11': 1 });
	});

	it('Grover finds the marked item 11 with certainty', () => {
		expectProbabilities('grover', { '11': 1 });
	});

	it("teleportation puts q0's starting state on q2", () => {
		// RY(π/3) on |0⟩ measures 1 with chance sin²(π/6) = 1/4. After the run,
		// q2 must have that chance, and q0 and q1 are left as fair coins.
		const { probabilities } = run('teleport');
		const marginal = (qubit: number) =>
			Object.entries(probabilities)
				.filter(([basis]) => basis[basis.length - 1 - qubit] === '1')
				.reduce((sum, [, p]) => sum + p, 0);
		expect(marginal(2)).toBeCloseTo(0.25);
		expect(marginal(0)).toBeCloseTo(0.5);
		expect(marginal(1)).toBeCloseTo(0.5);

		// The same state, not just the same odds: q2's Bloch vector matches what
		// RY(π/3) gives a lone qubit (x = sin θ, z = cos θ).
		const q2 = run('teleport').blochVectors![2];
		expect(q2.x).toBeCloseTo(Math.sin(Math.PI / 3));
		expect(q2.y).toBeCloseTo(0);
		expect(q2.z).toBeCloseTo(Math.cos(Math.PI / 3));
	});

	it('QFT-3 turns the input into the right phases', () => {
		// The circuit treats q0 as the top (most significant) bit, so X on q2 is
		// the number x = 1, and the output for y is e^{2πi·x·y/8}/√8. In the
		// simulator's index q0 is the lowest bit, so y is the index reversed.
		const steps = run('qft3').steps!;
		const state = steps[steps.length - 1].after;
		const reverse3 = (i: number) => ((i & 1) << 2) | (i & 2) | ((i & 4) >> 2);
		state.forEach((amp, index) => {
			const angle = (2 * Math.PI * reverse3(index)) / 8;
			expect(amp.re).toBeCloseTo(Math.cos(angle) / Math.sqrt(8));
			expect(amp.im).toBeCloseTo(Math.sin(angle) / Math.sqrt(8));
		});
	});
});
