import { circuitIR, currentCircuitId, currentCircuitName } from "../IR/stores";
import { showNotification } from "../utils/notificationUtils";
import { get } from "svelte/store";
import { upsertCircuit } from "../api/circuitApi";

let isDirty = false;
let consecutiveFailures = 0;
let initialized = false;
const MAX_FAILURES = 3;

//Subscribe to circuitIR changes
circuitIR.subscribe(() => {
    if (!initialized) { initialized = true; return; }
    isDirty = true;
});

setInterval(async () => {
    if (!isDirty) return;

    await attemptAutoSave();
    console.log("Auto-save attempt completed");

}, 5000); // Check every 5 seconds

async function attemptAutoSave() {
    if (consecutiveFailures >= MAX_FAILURES) return;
    try {
        const circuit_id = get(currentCircuitId);
        const name = get(currentCircuitName);
        await upsertCircuit(circuit_id, name, get(circuitIR));
        isDirty = false;
        consecutiveFailures = 0;
    } catch {
        consecutiveFailures++;
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
