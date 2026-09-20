import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';

/**
 * Opening a saved circuit takes a round trip to the backend and then a redraw,
 * which is long enough that a click with no feedback looks broken. These tests
 * lock the feedback in place: the row that was clicked says it is loading, and
 * no second circuit can be started while it runs.
 */

// A load we can hold open for as long as the test needs.
let releaseLoad: (ir: unknown) => void;
const loadCircuit = vi.fn(
	() =>
		new Promise((resolve) => {
			releaseLoad = resolve;
		})
);

vi.mock('$lib/api/circuitApi', () => ({
	listCircuits: async () => ({
		results: [
			{ circuit_id: 'c1', name: 'Bell pair', updated_at: '2026-09-20T10:00:00Z', is_public: false },
			{ circuit_id: 'c2', name: 'GHZ state', updated_at: '2026-09-19T10:00:00Z', is_public: false }
		],
		next: null,
		count: 2
	}),
	loadCircuit: () => loadCircuit(),
	deleteCircuit: vi.fn(),
	renameCircuit: vi.fn(),
	fetchAllCircuitIds: async () => ['c1', 'c2'],
	setCircuitPublic: vi.fn()
}));

const applyCircuit = vi.fn();
vi.mock('$lib/circuit/applyCircuit', () => ({
	applyCircuit: (...a: unknown[]) => applyCircuit(...a)
}));
vi.mock('$lib/utils/notificationUtils', () => ({ showNotification: vi.fn() }));

import MyCircuits from './MyCircuits.svelte';
import { circuitListCache } from '$lib/stores/circuitListCache';

function row(name: string): HTMLElement {
	return screen.getByText(name).closest('.circuit-row') as HTMLElement;
}

beforeEach(() => {
	circuitListCache.set({ circuits: [], total: 0, hasMore: false, loaded: false });
	loadCircuit.mockClear();
	applyCircuit.mockClear();
});

describe('MyCircuits — opening a saved circuit', () => {
	it('tells you the circuit is loading, on the row you clicked', async () => {
		const onClose = vi.fn();
		render(MyCircuits, { props: { onClose } });
		await screen.findByText('Bell pair');

		expect(screen.queryByText('Loading…')).toBeNull();

		await fireEvent.click(row('Bell pair'));

		await waitFor(() => expect(screen.getByText('Loading…')).toBeTruthy());
		expect(row('Bell pair').classList.contains('is-opening')).toBe(true);
		expect(row('Bell pair').getAttribute('aria-busy')).toBe('true');
	});

	it('steps the other rows back and stops them being clicked meanwhile', async () => {
		render(MyCircuits, { props: { onClose: vi.fn() } });
		await screen.findByText('Bell pair');

		await fireEvent.click(row('Bell pair'));
		await waitFor(() => expect(screen.getByText('Loading…')).toBeTruthy());

		expect(row('GHZ state').classList.contains('is-waiting')).toBe(true);

		// A second click, however it arrives, must not start another load.
		await fireEvent.click(row('GHZ state'));
		expect(loadCircuit).toHaveBeenCalledTimes(1);
	});

	it('drops the loading state and closes once the circuit is on the board', async () => {
		const onClose = vi.fn();
		render(MyCircuits, { props: { onClose } });
		await screen.findByText('Bell pair');

		await fireEvent.click(row('Bell pair'));
		await waitFor(() => expect(screen.getByText('Loading…')).toBeTruthy());

		releaseLoad({ version: '1.0', registers: { q: 1, c: 0 }, qubitLabels: [], operations: [] });

		await waitFor(() => expect(applyCircuit).toHaveBeenCalledOnce());
		await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
		expect(screen.queryByText('Loading…')).toBeNull();
	});
});
