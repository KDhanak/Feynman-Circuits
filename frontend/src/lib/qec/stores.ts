import { writable, derived } from 'svelte/store';
import type { QecResult, TimelineSnapshot } from './schema';

/**
 * The whole result of one experiment, exactly as the backend returned it.
 * Null before the first run. This is the QEC equivalent of `circuitIR`: the
 * single piece of truth every panel reads, and nothing else writes.
 */
export const qecResult = writable<QecResult | null>(null);

/** Index into `qecResult.timeline`, driven by the scrubber. */
export const currentStep = writable<number>(0);

/** Check id under the cursor, for cross-panel highlighting. Null when none. */
export const highlightedCheck = writable<string | null>(null);

/**
 * Which of the three epistemic layers are drawn. Being able to switch the
 * decoder's inference off and watch the truth and the syndrome stay put is
 * the point of separating them, so this is a first-class control, not chrome.
 */
export const visibleLayers = writable<{ truth: boolean; measured: boolean; inferred: boolean }>({
	truth: true,
	measured: true,
	inferred: true
});

/**
 * The timeline step being shown. Panels are pure functions of this — they read
 * it and never message each other, the same way SimulationResult and the Bloch
 * sphere both read `simulationResult` without knowing about one another.
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
 * QEC mode. While on, the editor restricts the circuit to Clifford operations,
 * because the QEC path is simulated by Stim and stabiliser simulators cannot
 * represent anything else. A view mode rather than a saved preference, so it
 * lives here and not in settingsStore.
 */
export const qecMode = writable<boolean>(false);

export function resetQec() {
	qecResult.set(null);
	currentStep.set(0);
	highlightedCheck.set(null);
}
