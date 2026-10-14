import { describe, it, expect } from 'vitest';
import { boundaryAxis, describeRound, matchingMarks } from '$lib/qec/matching';
import type { MatchingEdge } from '$lib/qec/schema';

const ref = (checkId: string, round: number) => ({ checkId, round });

describe('describeRound', () => {
	it('counts rounds from 1 and names the last detectors the final readout', () => {
		expect(describeRound(0, 3)).toBe('round 1');
		expect(describeRound(2, 3)).toBe('round 3');
		expect(describeRound(3, 3)).toBe('final readout');
	});
});

describe('boundaryAxis', () => {
	// X-error chains (seen by Z checks) run top to bottom, e.g. the hidden
	// q0, q3, q6 chain. Z-error chains (seen by X checks) run left to right.
	it('sends Z checks to the top or bottom and X checks to the sides', () => {
		expect(boundaryAxis('Z')).toBe('y');
		expect(boundaryAxis('X')).toBe('x');
	});
});

describe('matchingMarks', () => {
	it('draws a pair as a line between the two ancillas', () => {
		const edges: MatchingEdge[] = [{ kind: 'pair', a: ref('Z0', 1), b: ref('Z1', 1) }];
		const [mark] = matchingMarks(edges, 3);
		expect(mark).toMatchObject({ kind: 'pair', from: { x: 4, y: 2 }, to: { x: 2, y: 4 } });
		expect(mark.label).toBe('Z0 (round 2) paired with Z1 (round 2): one error chain between them.');
	});

	it('sends each boundary stub to the nearest edge a chain can leave by', () => {
		const stub = (checkId: string) =>
			matchingMarks([{ kind: 'boundary', a: ref(checkId, 0) }], 1)[0];
		expect(stub('Z2')).toMatchObject({ from: { x: 0, y: 2 }, to: { x: 0, y: 0 } });
		expect(stub('Z1')).toMatchObject({ from: { x: 2, y: 4 }, to: { x: 2, y: 6 } });
		expect(stub('X0')).toMatchObject({ from: { x: 2, y: 2 }, to: { x: 0, y: 2 } });
		expect(stub('X2')).toMatchObject({ from: { x: 4, y: 0 }, to: { x: 6, y: 0 } });
	});

	it('shows the same check in two rounds as a ring, called a faulty measurement', () => {
		const [mark] = matchingMarks([{ kind: 'pair', a: ref('X1', 0), b: ref('X1', 2) }], 3);
		expect(mark).toMatchObject({ kind: 'time', at: { x: 4, y: 4 } });
		expect(mark.label).toContain('round 1 and round 3');
		expect(mark.label).toContain('faulty measurement');
	});

	it('skips edges that name a check the layout does not have', () => {
		expect(matchingMarks([{ kind: 'boundary', a: ref('Q9', 0) }], 1)).toEqual([]);
	});

	it('never calls a guess the error that happened', () => {
		const edges: MatchingEdge[] = [
			{ kind: 'pair', a: ref('Z0', 0), b: ref('Z1', 0) },
			{ kind: 'boundary', a: ref('Z2', 0) },
			{ kind: 'pair', a: ref('Z3', 0), b: ref('Z3', 1) }
		];
		for (const m of matchingMarks(edges, 2)) {
			expect(m.label).toMatch(/paired/);
			expect(m.label).not.toMatch(/the error (that )?(happened|occurred)/i);
		}
	});
});
