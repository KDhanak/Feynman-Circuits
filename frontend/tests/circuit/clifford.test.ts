import { describe, it, expect } from 'vitest';
import {
	GATE_REGISTRY,
	UNITARY_GATE_IDS,
	NON_CLIFFORD_GATE_IDS,
	isCliffordGate
} from '$lib/quantum/gates';

// QEC mode blocks non-Clifford gates because Stim, which runs QEC, is a
// stabiliser simulator and cannot handle them. If a gate were put in the wrong
// group, we would either block valid circuits or allow ones the backend cannot
// run, with no warning. So we check it in a test, not only in a comment.

const CLIFFORD = ['x', 'y', 'z', 'h', 's', 'swap'];
const NON_CLIFFORD = ['t', 'p', 'rx', 'ry', 'rz'];

describe('Clifford classification', () => {
	it('covers every gate in the registry', () => {
		expect([...CLIFFORD, ...NON_CLIFFORD].sort()).toEqual([...UNITARY_GATE_IDS].sort());
	});

	it.each(CLIFFORD)('%s is Clifford', (id) => {
		expect(GATE_REGISTRY[id as keyof typeof GATE_REGISTRY].clifford).toBe(true);
		expect(isCliffordGate(id)).toBe(true);
	});

	it.each(NON_CLIFFORD)('%s is not Clifford', (id) => {
		expect(GATE_REGISTRY[id as keyof typeof GATE_REGISTRY].clifford).toBe(false);
		expect(isCliffordGate(id)).toBe(false);
	});

	it('treats the parametric gates as non-Clifford', () => {
		// P, RX, RY and RZ ARE Clifford when the angle is a multiple of pi/2, but the
		// editor lets the user pick any angle, so the palette cannot assume a safe one.
		for (const id of UNITARY_GATE_IDS) {
			if (GATE_REGISTRY[id].numParams > 0) expect(GATE_REGISTRY[id].clifford).toBe(false);
		}
	});

	it('exposes exactly the non-Clifford ids', () => {
		expect([...NON_CLIFFORD_GATE_IDS].sort()).toEqual([...NON_CLIFFORD].sort());
	});

	it('rejects ids that are not gates', () => {
		expect(isCliffordGate('CONTROL')).toBe(false);
		expect(isCliffordGate('nonsense')).toBe(false);
	});
});
