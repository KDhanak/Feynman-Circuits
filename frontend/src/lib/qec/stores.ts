import { writable, derived } from 'svelte/store';
import type { QecResult, TimelineSnapshot } from './schema';
import { DEFAULT_DRAFT, type QecDraft } from './draft';
import { MAX_QUBITS } from '$lib/utils/constants';

/**
 * The whole result of one experiment, exactly as the backend sent it.
 * Null before the first run. This works like `circuitIR` does for circuits:
 * it is the one main piece of data that every panel reads, and nothing else
 * changes it.
 */
export const qecResult = writable<QecResult | null>(null);

/** Position in `qecResult.timeline`, set by the timeline slider. */
export const currentStep = writable<number>(0);

/** Id of the check under the mouse, so other panels can highlight it too. Null when there is none. */
export const highlightedCheck = writable<string | null>(null);

/**
 * Which of the three layers of knowledge are shown. We keep the layers
 * separate so you can turn off the decoder's guess and see that the truth and
 * the syndrome do not change. So this is a real, important control, not just
 * decoration.
 */
export const visibleLayers = writable<{ truth: boolean; measured: boolean; inferred: boolean }>({
	truth: true,
	measured: true,
	inferred: true
});

/**
 * The timeline step being shown. Every panel just reads this and draws from
 * it. Panels never talk to each other directly, in the same way that
 * SimulationResult and the Bloch sphere both read `simulationResult` without
 * knowing about each other.
 */
export const currentSnapshot = derived(
	[qecResult, currentStep],
	([$qecResult, $currentStep]): TimelineSnapshot | null => {
		if (!$qecResult) return null;
		const clamped = Math.max(0, Math.min($currentStep, $qecResult.timeline.length - 1));
		return $qecResult.timeline[clamped] ?? null;
	}
);

/**
 * QEC mode. While it is on, the editor only allows Clifford operations,
 * because QEC runs are simulated by Stim, and stabiliser simulators cannot
 * handle anything else. This is a view mode, not a saved setting, so it is
 * kept here and not in settingsStore.
 */
export const qecMode = writable<boolean>(false);

/**
 * In QEC mode the circuit is ONE logical qubit: the one the 17 physical qubits
 * in the QEC panel protect. Everything that can add a qubit (the + button, the
 * count box, the ghost wire, SWAP, Bell Pair) reads this instead of MAX_QUBITS.
 */
export const QEC_LOGICAL_QUBITS = 1;
export const qubitLimit = derived(qecMode, ($on) => ($on ? QEC_LOGICAL_QUBITS : MAX_QUBITS));

// The QEC theme is a class on <html>, the same way dark mode is. The check
// keeps this from running during server rendering, where there is no page.
if (typeof document !== 'undefined') {
	qecMode.subscribe((on) => document.documentElement.classList.toggle('qec', on));
}

/**
 * The experiment being set up: rounds, the chosen Pauli and round, and the
 * errors placed so far (the injection ledger). Kept apart from `qecResult` on
 * purpose: this is what the user is ASKING for, the result is what came back.
 */
export const qecDraft = writable<QecDraft>(DEFAULT_DRAFT);

/** True while a run is waiting on the backend. */
export const qecRunning = writable<boolean>(false);

export function resetQec() {
	qecResult.set(null);
	currentStep.set(0);
	highlightedCheck.set(null);
}
