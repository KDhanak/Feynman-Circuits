import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import type { ComponentProps } from 'svelte';
import LatticePanel from './LatticePanel.svelte';
import { currentStep, qecResult } from '$lib/qec/stores';
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

beforeEach(() => {
	qecResult.set(null);
	currentStep.set(0);
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
});
