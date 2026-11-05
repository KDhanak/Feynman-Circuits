import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

// The preset re-runs the simulation and shows a toast. Neither matters here,
// and both reach for things a test does not have.
vi.mock('$lib/circuit/dragDropUtils', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/circuit/dragDropUtils')>()),
	triggerSimulation: vi.fn()
}));
vi.mock('../utils/notificationUtils', () => ({ showNotification: vi.fn() }));

import { applyBellPairPreset, type BellState } from './circuitActions';
import { circuitIR, emptyCircuitIR } from '$lib/IR/stores';
import { simulateMultipleQubits } from './simulator';

describe('applyBellPairPreset', () => {
	beforeEach(() => {
		circuitIR.set({ ...emptyCircuitIR(), registers: { q: 2, c: 2 } });
	});

	// Labels are as the simulator writes them: q0 is the rightmost bit.
	// Ψ⁻ = (|01⟩ − |10⟩)/√2 in |q0 q1⟩ order is +|01⟩ − |10⟩ here as well,
	// because swapping the bit order only flips the overall sign.
	const cases: [BellState, Record<string, number>][] = [
		['phi+', { '00': 0.5, '11': 0.5 }],
		['phi-', { '00': 0.5, '11': 0.5 }],
		['psi+', { '01': 0.5, '10': 0.5 }],
		['psi-', { '01': 0.5, '10': 0.5 }]
	];

	it.each(cases)('%s gives the right outcomes', (state, expected) => {
		applyBellPairPreset(state);
		const { probabilities } = simulateMultipleQubits(get(circuitIR));
		for (const [basis, p] of Object.entries(probabilities)) {
			expect(p).toBeCloseTo(expected[basis] ?? 0);
		}
	});

	it('puts a minus sign in Φ⁻ and Ψ⁻ only', () => {
		const signs = (['phi+', 'phi-', 'psi+', 'psi-'] as BellState[]).map((state) => {
			circuitIR.set({ ...emptyCircuitIR(), registers: { q: 2, c: 2 } });
			applyBellPairPreset(state);
			return simulateMultipleQubits(get(circuitIR)).formattedState?.includes('-');
		});
		expect(signs).toEqual([false, true, false, true]);
	});
});
