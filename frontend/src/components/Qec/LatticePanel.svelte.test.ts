import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import type { ComponentProps } from 'svelte';
import LatticePanel from './LatticePanel.svelte';
import { get } from 'svelte/store';
import { currentStep, qecResult, qecRunning, visibleLayers } from '$lib/qec/stores';
import type { InjectedError, QecResult } from '$lib/qec/schema';

// Svelte 5 passes old-style on: listeners down through the $$events prop,
// the same way GateToken's tests do it.
function setup(props: Partial<ComponentProps<typeof LatticePanel>> = {}) {
	const onClick = vi.fn();
	render(LatticePanel, {
		props: { ...props, $$events: { qubitclick: onClick } } as unknown as ComponentProps<
			typeof LatticePanel
		>
	});
	return { onClick };
}

const planned: InjectedError[] = [{ qubit: 4, pauli: 'Z', round: 0 }];

function resultWithNothingPlaced(): QecResult {
	return {
		layout: {} as QecResult['layout'],
		request: { rounds: 1, errors: [] },
		timeline: [
			{
				round: 0,
				phase: 'inject',
				truth: { injected: [] },
				measured: { syndrome: {}, detectionEvents: {} }
			}
		],
		inferred: null
	};
}

// X on q4 in round 1: Z0 and Z1 fire, the decoder pairs them. Steps are
// inject, measure, then the decode step at index 2.
function resultWithDecode(): QecResult {
	const snap = (phase: 'inject' | 'measure' | 'decode', round: number) => ({
		round,
		phase,
		truth: { injected: [{ qubit: 4, pauli: 'X' as const, round: 0 }] },
		measured: { syndrome: {}, detectionEvents: {} }
	});
	return {
		layout: {} as QecResult['layout'],
		request: { rounds: 1, errors: [{ qubit: 4, pauli: 'X', round: 0 }] },
		timeline: [snap('inject', 0), snap('measure', 0), snap('decode', 1)],
		inferred: {
			matching: [
				{ kind: 'pair', a: { round: 0, checkId: 'Z0' }, b: { round: 0, checkId: 'Z1' } },
				{ kind: 'boundary', a: { round: 0, checkId: 'Z2' } }
			],
			correction: [],
			logical: { observedFlip: 0, predictedFlip: 0, success: true }
		}
	};
}

const inferredMarks = () => document.querySelector('[data-layer="inferred"]');

beforeEach(() => {
	qecResult.set(null);
	currentStep.set(0);
	qecRunning.set(false);
	visibleLayers.set({ truth: true, measured: true, inferred: true });
});

describe('LatticePanel', () => {
	it('has no clickable qubits unless it is interactive', () => {
		setup();
		expect(screen.queryByLabelText(/^Data qubit 4\./)).toBeNull();
	});

	it('reports which data qubit was clicked', async () => {
		const { onClick } = setup({ interactive: true });
		await fireEvent.click(screen.getByLabelText(/^Data qubit 4\./));
		expect(onClick).toHaveBeenCalledOnce();
		expect(onClick.mock.calls[0][0].detail).toEqual({ qubit: 4 });
	});

	it('can be used from the keyboard', async () => {
		const { onClick } = setup({ interactive: true });
		await fireEvent.keyDown(screen.getByLabelText(/^Data qubit 7\./), { key: 'Enter' });
		expect(onClick.mock.calls[0][0].detail).toEqual({ qubit: 7 });
	});

	it('shows planned errors before a run, labelled as not run yet', () => {
		setup({ planned });
		expect(screen.getByText('Z')).toBeTruthy();
		expect(screen.getByText('placed, not run yet')).toBeTruthy();
	});

	it('stops showing planned errors once there is a result', () => {
		qecResult.set(resultWithNothingPlaced());
		setup({ planned });
		expect(screen.queryByText('Z')).toBeNull();
	});

	it('sweeps the checks while a run is in flight, in ancilla order', () => {
		qecRunning.set(true);
		setup();
		const sweeping = [...document.querySelectorAll('.sweeping')];
		expect(sweeping).toHaveLength(8);
		// Each check waits its turn by its place in the layout, so the sweep order
		// is the order the ancillas are measured in.
		expect(sweeping.map((g) => g.getAttribute('style'))).toEqual(
			Array.from({ length: 8 }, (_, i) => `--sweep-i: ${i};`)
		);
		expect(screen.getByRole('group', { name: /lattice/ }).getAttribute('aria-busy')).toBe('true');
	});

	it('leaves the lattice still when nothing is running', () => {
		setup();
		expect(document.querySelectorAll('.sweeping')).toHaveLength(0);
	});

	it("draws the decoder's guess on the decode step, one mark per pairing", () => {
		qecResult.set(resultWithDecode());
		currentStep.set(2);
		setup();
		const titles = [...(inferredMarks()?.querySelectorAll('title') ?? [])].map(
			(t) => t.textContent
		);
		expect(titles).toHaveLength(2);
		expect(titles[0]).toMatch(/^Z0 \(round 1\) paired with Z1 \(round 1\)/);
		expect(titles[1]).toMatch(/^Z2 \(round 1\) paired with the edge of the code/);
	});

	it("does not show the decoder's guess before the decode step", () => {
		qecResult.set(resultWithDecode());
		currentStep.set(1);
		setup();
		expect(inferredMarks()).toBeNull();
	});

	it("hides only the decoder's guess when its layer is switched off", async () => {
		qecResult.set(resultWithDecode());
		currentStep.set(2);
		setup();
		const truthMarksBefore = screen.getAllByText('X').length;

		await fireEvent.click(screen.getByRole('checkbox', { name: /decoder's guess/ }));

		expect(get(visibleLayers)).toEqual({ truth: true, measured: true, inferred: false });
		expect(inferredMarks()).toBeNull();
		// Layer 1 is drawn exactly as before.
		expect(screen.getAllByText('X')).toHaveLength(truthMarksBefore);
	});

	it('has a toggle for each of the three layers', () => {
		setup();
		for (const name of [/injected error/, /detection event/, /decoder's guess/]) {
			expect((screen.getByRole('checkbox', { name }) as HTMLInputElement).checked).toBe(true);
		}
	});
});
