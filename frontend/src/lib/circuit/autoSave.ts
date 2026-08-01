import { circuitIR, currentCircuitId, currentCircuitName } from '../IR/stores';
import { showNotification } from '../utils/notificationUtils';
import { get, writable } from 'svelte/store';
import { upsertCircuit, getNextUntitledName } from '../api/circuitApi';
import { session } from '$lib/auth/session';
import { saveStatus } from '../stores/uiStores';
import { settings } from '../stores/settingsStore';

const MAX_FAILURES = 3;

// Internal auto-save state. Grouped into a single store instead of loose
// module-level `let`s so it lives in one place and can be reset between tests
// via resetAutoSaveState().
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
// loaded from the user's saved circuits). Drives the Save/Rename button label.
export const isCircuitSaved = writable<boolean>(false);

// Exposed for tests: restore a clean slate between cases.
export function resetAutoSaveState() {
	autoSaveState.set({ ...INITIAL_STATE });
}

circuitIR.subscribe(() => {
	if (!get(autoSaveState).initialized) {
		autoSaveState.update((st) => ({ ...st, initialized: true }));
		return;
	}
	// Only mark as dirty if user is authenticated
	if (get(session).status !== 'authenticated') return;
	// any store change after a reset means the user is editing again
	autoSaveState.update((st) => ({ ...st, isReset: false, isDirty: true }));
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

// Restart the timer whenever the configured interval changes; the initial
// subscription call also kicks off the timer on module load.
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
		await upsertCircuit(circuit_id, name, get(circuitIR));
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
	autoSaveState.update((st) => ({ ...st, consecutiveFailures: 0, lastSaveError: null }));
	const success = await attemptAutoSave();
	autoSaveState.update((st) => ({ ...st, isDirty: false }));
	if (!success) throw get(autoSaveState).lastSaveError ?? new Error('Save failed');
}

// HMR guard: without this, editing this file in dev leaves the previous module's
// setInterval running while the fresh module starts another one, stacking up
// duplicate auto-save loops across reloads. dispose() runs right before the old
// module is replaced, giving us a chance to clear the timer.
if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		if (autoSaveTimer) clearInterval(autoSaveTimer);
	});
}
