import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Persisted across sessions — what the user has already been shown.
 *
 * Unknown keys from older versions survive the merge in `getInitial` and are
 * simply carried along, so dropping a field here can't break an existing
 * browser's saved state.
 */
export type OnboardingState = {
	/** The welcome prompt has been answered or dismissed at least once. */
	hasSeenWelcome: boolean;
	/** The product tour ran to the end (skipping counts as done — don't nag). */
	tourCompleted: boolean;
};

export const DEFAULT_ONBOARDING: OnboardingState = {
	hasSeenWelcome: false,
	tourCompleted: false
};

const STORAGE_KEY = 'onboarding-state';

function getInitial(): OnboardingState {
	if (!browser) return { ...DEFAULT_ONBOARDING };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_ONBOARDING };
		// Merge so newly-added fields fall back to defaults.
		return { ...DEFAULT_ONBOARDING, ...JSON.parse(raw) };
	} catch {
		return { ...DEFAULT_ONBOARDING };
	}
}

export const onboarding = writable<OnboardingState>(getInitial());

if (browser) {
	onboarding.subscribe((s) => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
	});
}

function patch(p: Partial<OnboardingState>) {
	onboarding.update((s) => ({ ...s, ...p }));
}

// ── Runtime flow state ───────────────────────────────────────────────────
// Deliberately not persisted: a half-finished tour should not resume on the
// next visit, it should just be replayable from the header's `?`.

/** Which overlay is on screen right now. */
export const activeFlow = writable<'welcome' | 'tour' | null>(null);

/** Index into the active tour's step list. */
export const tourStep = writable(0);

/** First-load entry point — only opens for someone who has never been here. */
export function maybeStartFirstRun() {
	if (!get(onboarding).hasSeenWelcome) activeFlow.set('welcome');
}

/** Header `?` — always reopens the prompt, so the tour stays replayable. */
export function openWelcome() {
	activeFlow.set('welcome');
}

export function startTour() {
	// Starting counts as seen: someone who quits halfway shouldn't be prompted
	// again on the next visit, only offered the `?`.
	patch({ hasSeenWelcome: true });
	tourStep.set(0);
	activeFlow.set('tour');
}

/** Ends the tour, whether by finishing or skipping — both suppress the prompt. */
export function endTour() {
	patch({ hasSeenWelcome: true, tourCompleted: true });
	activeFlow.set(null);
}

/** Closing the welcome modal without picking a track. */
export function dismissWelcome() {
	patch({ hasSeenWelcome: true });
	activeFlow.set(null);
}

export function resetOnboarding() {
	onboarding.set({ ...DEFAULT_ONBOARDING });
	activeFlow.set(null);
}
