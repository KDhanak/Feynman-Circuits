import { get, writable } from 'svelte/store';
import type { CircuitIR } from './schema';
import { circuitIR } from './stores';
import { triggerSimulation } from '../circuit/dragDropUtils';

// ─────────────────────────────────────────────────────────────
// Undo / redo.
//
// Every change to the circuit goes through the `circuitIR` store, so this file
// watches that one store and keeps a copy of the circuit after each change.
// Undo puts an older copy back, redo steps forward again. A circuit is small
// JSON, so keeping copies costs almost nothing.
//
// Copies are only kept for edits. Opening a saved circuit, importing a file or
// following a share link is not an edit, so `applyCircuit` calls resetHistory()
// and the old circuit's steps are thrown away. Without that, one Ctrl+Z after
// opening a circuit would bring back the circuit that was open before, while
// the name and id on screen still belonged to the new one, and auto-save would
// then write the wrong gates over it.
// ─────────────────────────────────────────────────────────────

// How many steps back the user can go. The circuits are small, but the list
// should not be able to grow without end.
const MAX_STEPS = 50;

// One action can change the store more than once. Dropping a gate can add a
// qubit and then move the gate, and shrinking the wire count removes one wire
// at a time in a loop. Typing in an angle box changes it on every keystroke.
// So we wait until the changes stop before keeping a copy, and the user gets
// one undo step for one action instead of three.
const SETTLE_MS = 250;

const past: CircuitIR[] = [];
const future: CircuitIR[] = [];

// The circuit as the history sees it right now.
let present: CircuitIR = get(circuitIR);

// True while undo or redo is putting an old circuit back. The store change that
// this causes must not be recorded as a new edit.
let restoring = false;

// A change we have seen but not kept a copy of yet, and the timer that is
// waiting for the changes to stop.
let waiting: CircuitIR | null = null;
let settleTimer: ReturnType<typeof setTimeout> | null = null;

// For the toolbar buttons: whether there is anything to go back or forward to.
export const canUndo = writable<boolean>(false);
export const canRedo = writable<boolean>(false);

function refreshFlags() {
	canUndo.set(past.length > 0);
	canRedo.set(future.length > 0);
}

function isSameCircuit(a: CircuitIR, b: CircuitIR): boolean {
	return a === b || JSON.stringify(a) === JSON.stringify(b);
}

// Keep a copy of the change we have been waiting on.
function keepCopy() {
	settleTimer = null;
	const next = waiting;
	waiting = null;
	if (!next) return;
	// Nothing really changed, so adding a step would only give the user an undo
	// press that does nothing.
	if (isSameCircuit(next, present)) return;

	past.push(present);
	if (past.length > MAX_STEPS) past.shift();
	present = next;
	// A new edit after an undo means there is nothing to redo any more.
	future.length = 0;
	refreshFlags();
}

// Keep the waiting copy right now instead of after the timer. Undo calls this
// first, so pressing Ctrl+Z straight after a drop still undoes that drop.
function settleNow() {
	if (settleTimer) clearTimeout(settleTimer);
	keepCopy();
}

function putBack(ir: CircuitIR) {
	restoring = true;
	circuitIR.set(ir);
	restoring = false;
	triggerSimulation(ir);
}

circuitIR.subscribe((ir) => {
	if (restoring) return;
	waiting = ir;
	if (settleTimer) clearTimeout(settleTimer);
	settleTimer = setTimeout(keepCopy, SETTLE_MS);
});

export function undo() {
	settleNow();
	const previous = past.pop();
	if (!previous) return;
	future.push(present);
	present = previous;
	putBack(previous);
	refreshFlags();
}

export function redo() {
	settleNow();
	const next = future.pop();
	if (!next) return;
	past.push(present);
	present = next;
	putBack(next);
	refreshFlags();
}

// Start again from this circuit with no steps to go back to. Called whenever a
// circuit is put on the board from somewhere else (the library, an import, a
// share link) — see the note at the top of this file.
export function resetHistory(ir: CircuitIR) {
	if (settleTimer) {
		clearTimeout(settleTimer);
		settleTimer = null;
	}
	waiting = null;
	past.length = 0;
	future.length = 0;
	present = ir;
	refreshFlags();
}
