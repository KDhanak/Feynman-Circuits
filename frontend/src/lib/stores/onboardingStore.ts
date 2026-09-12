import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Saved between visits: what the user has already been shown.
 *
 * Old keys we no longer know about are kept when `getInitial` merges the saved
 * data, and are just carried along. So removing a field here can't break the
 * data already saved in someone's browser.
 */
export type OnboardingState = {
	/** The welcome prompt has been answered or closed at least once. */
	hasSeenWelcome: boolean;
	/** The product tour was finished (skipping also counts as done, so we don't keep asking). */
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
		// Merge, so any newly added fields get their default values.
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
// Not saved, on purpose: a half-finished tour should not continue on the next
// visit. The user can just start it again from the `?` in the header.

/** Which overlay is on screen right now. */
export const activeFlow = writable<'welcome' | 'tour' | null>(null);

/** Which step of the current tour we are on. */
export const tourStep = writable(0);

/** Runs on first load. Only opens for someone who has never been here before. */
export function maybeStartFirstRun() {
	if (!get(onboarding).hasSeenWelcome) activeFlow.set('welcome');
}

/** The `?` in the header. It always opens the prompt again, so the tour can be replayed. */
export function openWelcome() {
	activeFlow.set('welcome');
}

export function startTour() {
	// Starting the tour counts as seen: someone who stops halfway shouldn't be asked
	// again on the next visit. They can still use the `?`.
	patch({ hasSeenWelcome: true });
	tourStep.set(0);
	activeFlow.set('tour');
}

/** Ends the tour, by finishing or skipping. Both stop the prompt from showing again. */
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
