import {
	circuitIR,
	currentCircuitId,
	currentCircuitIsPublic,
	currentCircuitName
} from '../IR/stores';
import { showNotification } from '../utils/notificationUtils';
import { get, writable } from 'svelte/store';
import { upsertCircuit, getNextUntitledName } from '../api/circuitApi';
import { session } from '$lib/auth/session';
import { saveStatus } from '../stores/uiStores';
import { settings } from '../stores/settingsStore';

const MAX_FAILURES = 3;

// Auto-save's own state. It is kept together in one store, instead of in many
// separate `let` variables, so it is all in one place and tests can reset it
// with resetAutoSaveState().
type AutoSaveState = {
	isDirty: boolean;
	isReset: boolean;
	nameResolved: boolean;
	consecutiveFailures: number;
	initialized: boolean;
	lastSaveError: unknown;
};

const INITIAL_STATE: AutoSaveState = {
	isDirty: false,
	isReset: false,
	nameResolved: false,
	consecutiveFailures: 0,
	initialized: false,
	lastSaveError: null
};

const autoSaveState = writable<AutoSaveState>({ ...INITIAL_STATE });

// Whether the current circuit exists on the server (saved at least once, or
// loaded from the user's saved circuits). Decides whether the button says Save or Rename.
export const isCircuitSaved = writable<boolean>(false);

// Used by tests: reset everything back to the start between tests.
export function resetAutoSaveState() {
	autoSaveState.set({ ...INITIAL_STATE });
}

circuitIR.subscribe(() => {
	if (!get(autoSaveState).initialized) {
		autoSaveState.update((st) => ({ ...st, initialized: true }));
		return;
	}
	// Any change to the store after a reset means the user is editing again. We
	// track this even when the user is signed out: if someone builds a circuit (or
	// opens one shared with them) while signed out and then signs in, they should
	// not have to touch the board again before it can be saved. The sign-in check
	// is in attemptAutoSave, because that is the part that really talks to the server.
	autoSaveState.update((st) => ({ ...st, isReset: false, isDirty: true }));
	if (get(session).status !== 'authenticated') return;
	if (get(settings).autoSaveEnabled) saveStatus.set('saving');
});

let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

function startAutoSaveTimer(intervalMs: number) {
	if (autoSaveTimer) clearInterval(autoSaveTimer);
	autoSaveTimer = setInterval(async () => {
		if (!get(autoSaveState).isDirty) return;
		if (!get(settings).autoSaveEnabled) return;
		await attemptAutoSave();
	}, intervalMs);
}

// Restart the timer whenever the auto-save interval setting changes. The first
// subscribe call also starts the timer when this file first loads.
let currentInterval: number | null = null;
settings.subscribe((s) => {
	if (s.autoSaveIntervalMs !== currentInterval) {
		currentInterval = s.autoSaveIntervalMs;
		startAutoSaveTimer(s.autoSaveIntervalMs);
	}
});

export function markAsReset() {
	autoSaveState.update((st) => ({ ...st, isReset: true, isDirty: false }));
	saveStatus.set('idle');
}

export function markNameResolved() {
	autoSaveState.update((st) => ({ ...st, nameResolved: true }));
}

async function attemptAutoSave(): Promise<boolean> {
	const s = get(autoSaveState);
	if (s.consecutiveFailures >= MAX_FAILURES) return false;
	if (get(session).status !== 'authenticated') return false;
	if (s.isReset) return false;
	try {
		const circuit_id = get(currentCircuitId);
		let name = get(currentCircuitName);
		if (!s.nameResolved && name === 'Untitled Circuit') {
			name = await getNextUntitledName();
			currentCircuitName.set(name);
		}
		autoSaveState.update((st) => ({ ...st, nameResolved: true }));
		saveStatus.set('saving');
		const stored = await upsertCircuit(circuit_id, name, get(circuitIR));

		// The server may have saved this under a different id than the one we asked for.
		// Saving a circuit that was shared with us creates our own copy with a new
		// id. We must switch to that id, or every later save would hit the same
		// clash and we would keep trying to write to a circuit that is not ours.
		if (stored.circuit_id && stored.circuit_id !== circuit_id) {
			currentCircuitId.set(stored.circuit_id);
			// A copy always starts private, even if the original was public.
			currentCircuitIsPublic.set(false);
		}
		if (stored.name && stored.name !== name) currentCircuitName.set(stored.name);

		autoSaveState.update((st) => ({ ...st, isDirty: false, consecutiveFailures: 0 }));
		isCircuitSaved.set(true);
		saveStatus.set('saved');
		setTimeout(() => saveStatus.set('idle'), 2000);
		return true;
	} catch (err) {
		let failures = 0;
		autoSaveState.update((st) => {
			failures = st.consecutiveFailures + 1;
			return { ...st, lastSaveError: err, consecutiveFailures: failures };
		});
		saveStatus.set('error');
		if (failures >= MAX_FAILURES) {
			showNotification(
				'Auto-save failed multiple times. Please check your connection or save manually.',
				'error'
			);
		}
		return false;
	}
}

export async function manualSave(): Promise<void> {
	// Clearing isReset is what makes a manual save different from an automatic one.
	// `isReset` is there to stop auto-save from saving a circuit the user has not
	// touched. But clicking Save Circuit clearly means "save this", so it must work
	// even for an untouched circuit, such as one just opened from a share link and
	// saved without changes.
	autoSaveState.update((st) => ({
		...st,
		consecutiveFailures: 0,
		lastSaveError: null,
		isReset: false
	}));
	const success = await attemptAutoSave();
	autoSaveState.update((st) => ({ ...st, isDirty: false }));
	if (!success) throw get(autoSaveState).lastSaveError ?? new Error('Save failed');
}

// HMR (hot reload) guard: without this, editing this file during development
// leaves the old copy's setInterval running while the new copy starts another
// one, so we end up with many auto-save loops running at once. dispose() runs
// just before the old copy is replaced, so we can stop its timer there.
if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		if (autoSaveTimer) clearInterval(autoSaveTimer);
	});
}
