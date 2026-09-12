import { describe, it, expect } from 'vitest';
import { D3_LAYOUT, checksAffectedBy, getCheck } from '$lib/qec/layout';

const xChecks = D3_LAYOUT.checks.filter((c) => c.type === 'X');
const zChecks = D3_LAYOUT.checks.filter((c) => c.type === 'Z');

const overlap = (a: number[], b: number[]) => a.filter((q) => b.includes(q)).length;

describe('d=3 rotated surface code layout', () => {
	it('has 9 data qubits, 8 checks, and encodes one logical qubit', () => {
		// d^2 data qubits, d^2 - 1 checks. These numbers come from the code itself,
		// we did not choose them: 9 - 8 = 1 logical qubit.
		expect(D3_LAYOUT.dataQubits).toHaveLength(9);
		expect(D3_LAYOUT.checks).toHaveLength(8);
		expect(D3_LAYOUT.distance).toBe(3);
	});

	it('splits evenly into four X checks and four Z checks', () => {
		expect(xChecks).toHaveLength(4);
		expect(zChecks).toHaveLength(4);
	});

	it('gives every check and data qubit a unique id', () => {
		expect(new Set(D3_LAYOUT.checks.map((c) => c.id)).size).toBe(8);
		expect(new Set(D3_LAYOUT.dataQubits.map((q) => q.id)).size).toBe(9);
	});

	it('references only data qubits that exist', () => {
		const ids = new Set(D3_LAYOUT.dataQubits.map((q) => q.id));
		for (const check of D3_LAYOUT.checks) {
			for (const q of check.dataQubits) expect(ids.has(q)).toBe(true);
		}
	});

	it('places data on odd-odd sites and checks on even-even sites', () => {
		// Stim's rule. The backend copy depends on it, and so do the
		// DETECTOR(x, y, r) lines.
		for (const q of D3_LAYOUT.dataQubits) {
			expect(q.x % 2).toBe(1);
			expect(q.y % 2).toBe(1);
		}
		for (const c of D3_LAYOUT.checks) {
			expect(c.x % 2).toBe(0);
			expect(c.y % 2).toBe(0);
		}
	});

	it('has weight-4 bulk checks and weight-2 boundary checks only', () => {
		for (const c of D3_LAYOUT.checks) {
			expect([2, 4]).toContain(c.dataQubits.length);
		}
	});

	// The main rule of a stabiliser code: all generators must commute.
	// For Pauli products, an X check and a Z check commute only if they share an
	// even number of data qubits. This test finds a wrongly typed coordinate much
	// faster than staring at the picture ever could.
	it('has mutually commuting stabilisers', () => {
		for (const x of xChecks) {
			for (const z of zChecks) {
				expect(
					overlap(x.dataQubits, z.dataQubits) % 2,
					`${x.id} and ${z.id} share an odd number of data qubits`
				).toBe(0);
			}
		}
	});

	it('has a logical Z that commutes with every X check', () => {
		for (const x of xChecks) {
			expect(
				overlap(D3_LAYOUT.logicalZ, x.dataQubits) % 2,
				`logical Z anticommutes with ${x.id}`
			).toBe(0);
		}
	});

	it('has a logical Z whose weight is the code distance', () => {
		// This is what "distance 3" means: three errors at the same time is the
		// smallest number that can flip the logical qubit without being noticed.
		expect(D3_LAYOUT.logicalZ).toHaveLength(D3_LAYOUT.distance);
	});

	it('covers every data qubit with at least one X and one Z check', () => {
		for (const q of D3_LAYOUT.dataQubits) {
			expect(xChecks.some((c) => c.dataQubits.includes(q.id))).toBe(true);
			expect(zChecks.some((c) => c.dataQubits.includes(q.id))).toBe(true);
		}
	});
});

describe('error-to-check anchors', () => {
	// Expected results worked out by hand. The backend tests check the same cases
	// against Stim, so if the two disagree we know right away which side is wrong.
	const sorted = (ids: string[]) => [...ids].sort();

	it('X on the centre qubit fires both adjacent Z checks', () => {
		expect(sorted(checksAffectedBy(4, 'X'))).toEqual(['Z0', 'Z1']);
	});

	it('X on a corner qubit fires exactly one Z check', () => {
		expect(sorted(checksAffectedBy(0, 'X'))).toEqual(['Z2']);
	});

	it('Z on the centre qubit fires both adjacent X checks', () => {
		expect(sorted(checksAffectedBy(4, 'Z'))).toEqual(['X0', 'X1']);
	});

	it('Y on the centre qubit fires all four adjacent checks', () => {
		expect(sorted(checksAffectedBy(4, 'Y'))).toEqual(['X0', 'X1', 'Z0', 'Z1']);
	});

	it('a logical Z error fires no X check at all', () => {
		// Three Z errors along the logical operator cannot be detected. The tool
		// has to be able to show this, so the layout must make it true.
		const firedX = D3_LAYOUT.logicalZ.flatMap((q) => checksAffectedBy(q, 'Z'));
		const parity = new Map<string, number>();
		for (const id of firedX) parity.set(id, (parity.get(id) ?? 0) + 1);
		for (const [id, count] of parity) {
			expect(count % 2, `${id} would fire`).toBe(0);
		}
	});
});

describe('lookup helpers', () => {
	it('finds a check by id', () => {
		expect(getCheck('Z0')?.dataQubits).toEqual([1, 2, 4, 5]);
	});

	it('returns undefined for an unknown id', () => {
		expect(getCheck('Z9')).toBeUndefined();
	});
});
