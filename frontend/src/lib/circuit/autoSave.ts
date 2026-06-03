import { circuitIR, currentCircuitId, currentCircuitName } from "../IR/stores";
import { showNotification } from "../utils/notificationUtils";
import { get } from "svelte/store";
import { upsertCircuit, getNextUntitledName } from "../api/circuitApi";
import { session } from "$lib/auth/session";
import { saveStatus } from "../stores/uiStores";

let isDirty = false;
let isReset = false;
let nameResolved = false;
let consecutiveFailures = 0;
let initialized = false;
const MAX_FAILURES = 3;

circuitIR.subscribe(() => {
    if (!initialized) { initialized = true; return; }
    isReset = false;  // any store change after a reset means the user is editing again
    isDirty = true;
    saveStatus.set('saving');
});

setInterval(async () => {
    if (!isDirty) return;

    await attemptAutoSave();
    console.log("Auto-save attempt completed");

}, 10_000); // Check every 10 seconds

export function markAsReset() {
    isReset = true;
    isDirty = false;
    saveStatus.set('idle');
}

export function markNameResolved() {
    nameResolved = true;
}

async function attemptAutoSave() {
    if (consecutiveFailures >= MAX_FAILURES) return;
    if (get(session).status !== 'authenticated') return;
    if (isReset) return;
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
    } catch {
        consecutiveFailures++;
        saveStatus.set('error');
        if (consecutiveFailures >= MAX_FAILURES) {
            showNotification("Auto-save failed multiple times. Please check your connection or save manually.", "error");
        }
    }
}

export async function manualSave(): Promise<void> {
    consecutiveFailures = 0;
    await attemptAutoSave();
    isDirty = false;
}
