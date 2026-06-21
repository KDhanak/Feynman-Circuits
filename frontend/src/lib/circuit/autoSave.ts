import { circuitIR, currentCircuitId, currentCircuitName } from "../IR/stores";
import { showNotification } from "../utils/notificationUtils";
import { get } from "svelte/store";
import { upsertCircuit, getNextUntitledName } from "../api/circuitApi";
import { session } from "$lib/auth/session";
import { saveStatus } from "../stores/uiStores";
import { settings } from "../stores/settingsStore";

let isDirty = false;
let isReset = false;
let nameResolved = false;
let consecutiveFailures = 0;
let initialized = false;
let lastSaveError: unknown = null;
const MAX_FAILURES = 3;

circuitIR.subscribe(() => {
    if (!initialized) { initialized = true; return; }
    // Only mark as dirty if user is authenticated
    if (get(session).status !== 'authenticated') return;
    isReset = false;  // any store change after a reset means the user is editing again
    isDirty = true;
    if (get(settings).autoSaveEnabled) saveStatus.set('saving');
});

let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

function startAutoSaveTimer(intervalMs: number) {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    autoSaveTimer = setInterval(async () => {
        if (!isDirty) return;
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
    isReset = true;
    isDirty = false;
    saveStatus.set('idle');
}

export function markNameResolved() {
    nameResolved = true;
}

async function attemptAutoSave(): Promise<boolean> {
    if (consecutiveFailures >= MAX_FAILURES) return false;
    if (get(session).status !== 'authenticated') return false;
    if (isReset) return false;
    try {
        const circuit_id = get(currentCircuitId);
        let name = get(currentCircuitName);
        if (!nameResolved && name === 'Untitled Circuit') {
            name = await getNextUntitledName();
            currentCircuitName.set(name);
        }
        nameResolved = true;
        saveStatus.set('saving');
        await upsertCircuit(circuit_id, name, get(circuitIR));
        isDirty = false;
        consecutiveFailures = 0;
        saveStatus.set('saved');
        setTimeout(() => saveStatus.set('idle'), 2000);
        return true;
    } catch (err) {
        lastSaveError = err;
        consecutiveFailures++;
        saveStatus.set('error');
        if (consecutiveFailures >= MAX_FAILURES) {
            showNotification("Auto-save failed multiple times. Please check your connection or save manually.", "error");
        }
        return false;
    }
}

export async function manualSave(): Promise<void> {
    consecutiveFailures = 0;
    lastSaveError = null;
    const success = await attemptAutoSave();
    isDirty = false;
    if (!success) throw lastSaveError ?? new Error('Save failed');
}
