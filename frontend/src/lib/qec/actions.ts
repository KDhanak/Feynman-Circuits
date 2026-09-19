import axios from 'axios';
import { get } from 'svelte/store';
import { runQec } from '$lib/api/qecApi';
import { showNotification } from '$lib/utils/notificationUtils';
import type { Pauli } from './schema';
import { MAX_ERRORS, toggleError, withRounds, wouldAdd } from './draft';
import { currentStep, qecDraft, qecResult, qecRunning, resetQec } from './stores';

// Every change to the ledger or the number of rounds clears the last result.
// Otherwise the lattice could show the result of an older setup next to a
// ledger that no longer matches it, and those two must always agree.

export function placeError(qubit: number): void {
	const d = get(qecDraft);
	if (wouldAdd(d.errors, qubit, d.round) && d.errors.length >= MAX_ERRORS) {
		showNotification(`At most ${MAX_ERRORS} errors per run.`, 'error');
		return;
	}
	qecDraft.set({ ...d, errors: toggleError(d.errors, qubit, d.pauli, d.round) });
	resetQec();
}

export function removeError(qubit: number, round: number): void {
	qecDraft.update((d) => ({
		...d,
		errors: d.errors.filter((e) => !(e.qubit === qubit && e.round === round))
	}));
	resetQec();
}

export function clearErrors(): void {
	qecDraft.update((d) => ({ ...d, errors: [] }));
	resetQec();
}

export function setRounds(rounds: number): void {
	qecDraft.update((d) => withRounds(d, rounds));
	resetQec();
}

// Choosing a Pauli or a round only changes what the NEXT click places, so
// these leave the result alone.
export function setPauli(pauli: Pauli): void {
	qecDraft.update((d) => ({ ...d, pauli }));
}

export function setRound(round: number): void {
	qecDraft.update((d) => ({ ...d, round: Math.max(0, Math.min(d.rounds - 1, round)) }));
}

export async function runExperiment(): Promise<void> {
	if (get(qecRunning)) return;
	const { rounds, errors } = get(qecDraft);
	const sent = JSON.stringify({ rounds, errors });
	qecRunning.set(true);
	try {
		const result = await runQec({ rounds, errors });
		// If the user changed the setup while this was running, this result
		// belongs to a setup that no longer exists, so it is thrown away.
		const now = get(qecDraft);
		if (JSON.stringify({ rounds: now.rounds, errors: now.errors }) !== sent) return;
		qecResult.set(result);
		currentStep.set(0);
	} catch (err) {
		showNotification(runErrorMessage(err), 'error', 4000);
	} finally {
		qecRunning.set(false);
	}
}

export function stepBy(delta: number): void {
	const result = get(qecResult);
	if (!result) return;
	const last = result.timeline.length - 1;
	currentStep.update((s) => Math.max(0, Math.min(last, s + delta)));
}

export function runErrorMessage(err: unknown): string {
	if (axios.isAxiosError(err)) {
		if (!err.response) return 'Could not reach the QEC backend. Is the Django server running?';
		if (err.response.status === 429) return 'Too many runs this hour. Try again later.';
		if (err.response.status === 400) return 'The backend rejected this setup.';
	}
	return 'The QEC run failed.';
}
