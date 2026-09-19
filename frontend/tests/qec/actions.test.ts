import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { AxiosError, type AxiosResponse } from 'axios';

vi.mock('$lib/api/qecApi', () => ({ runQec: vi.fn() }));
vi.mock('$lib/utils/notificationUtils', () => ({ showNotification: vi.fn() }));

import { runQec } from '$lib/api/qecApi';
import { showNotification } from '$lib/utils/notificationUtils';
import {
	placeError,
	runErrorMessage,
	runExperiment,
	setPauli,
	setRound,
	setRounds,
	stepBy
} from '$lib/qec/actions';
import { currentStep, qecDraft, qecResult, qecRunning } from '$lib/qec/stores';
import { DEFAULT_DRAFT, MAX_ERRORS } from '$lib/qec/draft';
import type { QecResult } from '$lib/qec/schema';

function fakeResult(steps = 7): QecResult {
	return {
		layout: {} as QecResult['layout'],
		request: { rounds: 3, errors: [] },
		timeline: Array.from({ length: steps }, (_, i) => ({
			round: Math.floor(i / 2),
			phase: 'measure' as const,
			truth: { injected: [] },
			measured: { syndrome: {}, detectionEvents: {} }
		})),
		inferred: null
	};
}

beforeEach(() => {
	qecDraft.set({ ...DEFAULT_DRAFT, errors: [] });
	qecResult.set(null);
	currentStep.set(0);
	qecRunning.set(false);
	vi.mocked(runQec).mockReset();
	vi.mocked(showNotification).mockReset();
});

describe('placing errors', () => {
	it('uses the chosen Pauli and round', () => {
		setRounds(3);
		setPauli('Z');
		setRound(2);
		placeError(4);
		expect(get(qecDraft).errors).toEqual([{ qubit: 4, pauli: 'Z', round: 2 }]);
	});

	it('clears the last result, so it can never disagree with the ledger', () => {
		qecResult.set(fakeResult());
		placeError(4);
		expect(get(qecResult)).toBeNull();
	});

	it('choosing a Pauli or round does not clear the result', () => {
		qecResult.set(fakeResult());
		setPauli('Y');
		setRound(1);
		expect(get(qecResult)).not.toBeNull();
	});

	it('refuses to go past the limit and says why', () => {
		qecDraft.update((d) => ({
			...d,
			rounds: 15,
			errors: Array.from({ length: MAX_ERRORS }, (_, i) => ({
				qubit: i % 9,
				pauli: 'X' as const,
				round: Math.floor(i / 9)
			}))
		}));
		setRound(14);
		placeError(0);
		expect(get(qecDraft).errors).toHaveLength(MAX_ERRORS);
		expect(showNotification).toHaveBeenCalledOnce();
	});
});

describe('running', () => {
	it('sends the draft, stores the result, and starts at the first step', async () => {
		vi.mocked(runQec).mockResolvedValue(fakeResult());
		placeError(4);
		currentStep.set(3);
		await runExperiment();
		expect(runQec).toHaveBeenCalledWith({
			rounds: 3,
			errors: [{ qubit: 4, pauli: 'X', round: 0 }]
		});
		expect(get(qecResult)).not.toBeNull();
		expect(get(currentStep)).toBe(0);
		expect(get(qecRunning)).toBe(false);
	});

	it('throws away a result if the setup changed while it was running', async () => {
		let finish: (r: QecResult) => void = () => {};
		vi.mocked(runQec).mockReturnValue(new Promise((resolve) => (finish = resolve)));
		const running = runExperiment();
		placeError(4);
		finish(fakeResult());
		await running;
		expect(get(qecResult)).toBeNull();
	});

	it('reports a failed run and stops the spinner', async () => {
		vi.mocked(runQec).mockRejectedValue(new Error('boom'));
		await runExperiment();
		expect(showNotification).toHaveBeenCalledWith('The QEC run failed.', 'error', 4000);
		expect(get(qecRunning)).toBe(false);
	});
});

describe('stepping', () => {
	it('stays inside the timeline at both ends', () => {
		qecResult.set(fakeResult(7));
		stepBy(-1);
		expect(get(currentStep)).toBe(0);
		stepBy(100);
		expect(get(currentStep)).toBe(6);
	});

	it('does nothing before there is a result', () => {
		stepBy(1);
		expect(get(currentStep)).toBe(0);
	});
});

describe('error messages', () => {
	const withStatus = (status: number) =>
		new AxiosError('x', 'ERR', undefined, undefined, { status } as AxiosResponse);

	it('points at the Django server when there is no response at all', () => {
		expect(runErrorMessage(new AxiosError('Network Error', 'ERR_NETWORK'))).toMatch(/Django/);
	});

	it('explains the throttle', () => {
		expect(runErrorMessage(withStatus(429))).toMatch(/Too many runs/);
	});

	it('explains a rejected setup', () => {
		expect(runErrorMessage(withStatus(400))).toMatch(/rejected/);
	});
});
