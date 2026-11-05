import { get, writable } from 'svelte/store';
import type { CircuitIR, GateData } from '$lib/IR/schema';
import { circuitIR } from '$lib/IR/stores';
import {
	resetHistory,
	restoreHistory,
	snapshotHistory,
	undo,
	type HistorySnapshot
} from '$lib/IR/history';
import {
	editGateRequest,
	handleDoubleClick,
	handleDrop,
	pendingAntiControls,
	pendingControls,
	triggerSimulation
} from '$lib/circuit/dragDropUtils';
import {
	deleteSelectedGates,
	dragCurrent,
	dragStart,
	isDragSelecting,
	selectedGateIds,
	toggleGateSelection
} from '$lib/circuit/selection';
import { armedGate, circuitLayout, demoRunning } from '$lib/stores/uiStores';
import { isMobile } from '$lib/stores/isMobile';

// ─────────────────────────────────────────────────────────────
// The board demo: an animated hand that really works the board.
//
// Every change it makes goes through the same functions a real drag, click or
// key press uses, so what the user watches is exactly what the app does. The
// hand and its effects (click ripples, the gate it carries, key caps) are only
// drawn on top by DemoHand.svelte; they do not cause anything themselves.
//
// The demo borrows the user's board. Before it starts it keeps the circuit,
// the undo/redo history, waiting control dots and the selection, then plays on
// a clean two-qubit board. When it ends, or is stopped, all of it is put back.
// Auto-save ignores the board while `demoRunning` is on (see autoSave.ts).
// ─────────────────────────────────────────────────────────────

export type Point = { x: number; y: number };

export type HandState = {
	x: number;
	y: number;
	visible: boolean;
	/** Finger pressed down: drawn a little smaller. */
	pressed: boolean;
	/** HTML copy of the gate being dragged, drawn under the finger. */
	carrying: string | null;
	/** Goes up by one for every click, which plays one ripple. */
	clicks: number;
	/** A press-and-hold is running: drawn as a ring filling up. */
	holding: boolean;
	/** Name of the gesture, shown next to the hand ("Double-click"). */
	gesture: string | null;
	/** Keys being held or pressed, shown as key caps next to the hand. */
	keys: string[];
};

const HIDDEN_HAND: HandState = {
	x: 0,
	y: 0,
	visible: false,
	pressed: false,
	carrying: null,
	clicks: 0,
	holding: false,
	gesture: null,
	keys: []
};

export const hand = writable<HandState>({ ...HIDDEN_HAND });

export type Caption = { title: string; body: string; index: number; count: number };
export const caption = writable<Caption | null>(null);

// ── Stopping ─────────────────────────────────────────────────

class Stopped extends Error {}

// Each run gets a number. Stopping moves the number on, and every wait checks
// it, so the script stops at its next wait (never more than a moment away).
let runId = 0;
let activeRun = 0;

function checkRunning() {
	if (activeRun !== runId) throw new Stopped();
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve, reject) => {
		setTimeout(() => (activeRun === runId ? resolve() : reject(new Stopped())), ms);
	});
}

export function stopBoardDemo() {
	runId++;
}

// ── Finding things on screen ─────────────────────────────────

function centre(el: Element): Point {
	const r = el.getBoundingClientRect();
	return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function must<T extends Element>(el: T | null, what: string): T {
	if (!el) throw new Error(`Board demo: could not find ${what}`);
	return el;
}

const paletteTile = (type: string) =>
	must(document.querySelector(`[data-palette-type="${type}"]`), `the ${type} palette tile`);

const gateEl = (id: string) =>
	must(
		document.querySelector(`[data-gate-id="${id}"][data-type="GATE"]`),
		`the gate on the board`
	);

const button = (label: string) =>
	must(document.querySelector<HTMLElement>(`[aria-label="${label}"]`), `the ${label} button`);

/** The middle of a cell on the board. */
function cell(col: number, qubit: number): Point {
	const row = must(
		document.querySelector(`[data-wire-row][data-qubit="${qubit}"]`),
		`wire ${qubit}`
	);
	const r = row.getBoundingClientRect();
	const w = get(circuitLayout).columnWidth;
	return { x: r.left + (col + 0.5) * w, y: r.top + r.height / 2 };
}

/** The id of the operation the last action added. */
function newOpId(before: CircuitIR): string {
	const old = new Set(before.operations.map((op) => op.id));
	const added = get(circuitIR).operations.find((op) => !old.has(op.id));
	if (!added) throw new Error('Board demo: the new gate is missing');
	return added.id;
}

// A copy of a gate's look for the hand to carry. data-* attributes are taken
// off, so nothing that searches the board for a gate can find the copy.
function carryCopy(el: Element): string {
	const c = el.cloneNode(true) as HTMLElement;
	for (const attr of [...c.attributes]) {
		if (attr.name.startsWith('data-') && attr.name !== 'data-family') c.removeAttribute(attr.name);
	}
	c.classList.remove('selected', 'copying');
	c.style.position = 'absolute';
	c.style.left = '0';
	c.style.top = '0';
	c.style.transform = 'translate(-50%, -50%)';
	return c.outerHTML;
}

// ── What the hand can do ─────────────────────────────────────

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Glide the hand to a point. `onStep` runs on every frame, for things that follow it. */
function moveTo(to: Point, ms = 650, onStep?: (p: Point) => void): Promise<void> {
	const from = get(hand);
	const start = performance.now();
	return new Promise((resolve, reject) => {
		const frame = (now: number) => {
			if (activeRun !== runId) return reject(new Stopped());
			const t = Math.min(1, (now - start) / ms);
			const k = ease(t);
			const p = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
			hand.update((h) => ({ ...h, x: p.x, y: p.y }));
			onStep?.(p);
			if (t < 1) requestAnimationFrame(frame);
			else resolve();
		};
		requestAnimationFrame(frame);
	});
}

const setHand = (p: Partial<HandState>) => hand.update((h) => ({ ...h, ...p }));

async function press() {
	setHand({ pressed: true });
	await wait(140);
}

async function release() {
	setHand({ pressed: false });
	await wait(120);
}

async function click() {
	await press();
	hand.update((h) => ({ ...h, clicks: h.clicks + 1 }));
	await release();
}

async function gesture(name: string, run: () => Promise<void>) {
	setHand({ gesture: name });
	await run();
	await wait(450);
	setHand({ gesture: null });
}

async function doubleClick() {
	await gesture('Double-click', async () => {
		await click();
		await wait(60);
		await click();
	});
}

async function holdPress() {
	await gesture('Press and hold', async () => {
		setHand({ pressed: true, holding: true });
		await wait(750);
		setHand({ pressed: false, holding: false });
	});
}

/** Show key caps next to the hand, as if they were pressed. */
async function keys(names: string[], ms = 900) {
	setHand({ keys: names });
	await wait(ms);
	setHand({ keys: [] });
}

/** Pick up `el`, carry a copy of it to `to`, and let go. */
async function drag(el: Element, to: Point) {
	await moveTo(centre(el));
	await press();
	setHand({ carrying: carryCopy(el) });
	await moveTo(to, 900);
	setHand({ carrying: null });
	await release();
}

// Sends a drop through the real drop code, the same way tap-to-place does.
function drop(data: GateData, col: number, qubit: number) {
	const e = {
		preventDefault: () => {},
		dataTransfer: { getData: () => JSON.stringify(data) }
	} as unknown as DragEvent;
	handleDrop(e, col, qubit);
}

/** Place a palette gate: drag it on desktop, tap it then tap the cell on a phone. */
async function placeFromPalette(type: string, col: number, qubit: number) {
	const tile = paletteTile(type);
	if (get(isMobile)) {
		await moveTo(centre(tile));
		await gesture('Tap', click);
		await moveTo(cell(col, qubit), 800);
		await gesture('Tap', click);
	} else {
		await drag(tile, cell(col, qubit));
	}
	drop({ source: 'palette', gateType: type }, col, qubit);
	armedGate.set(null);
	await wait(300);
}

/** Type into a text box one letter at a time, the way a person would. */
async function typeInto(input: HTMLInputElement, text: string) {
	await moveTo(centre(input));
	await click();
	input.focus();
	input.value = '';
	input.dispatchEvent(new Event('input', { bubbles: true }));
	for (const ch of text) {
		await wait(120);
		input.value += ch;
		input.dispatchEvent(new Event('input', { bubbles: true }));
	}
	await wait(300);
}

const angleBox = () =>
	must(document.querySelector<HTMLInputElement>('#gate-angle'), 'the angle box');

// ── The script ───────────────────────────────────────────────

type Scene = {
	title: string;
	body: string;
	/** Different words for touch screens, where the moves are taps and holds. */
	mobileBody?: string;
	/** Some moves have no touch version (Ctrl-drag, box select). */
	desktopOnly?: boolean;
	run: () => Promise<void>;
};

// Ids of gates the later scenes go back to.
let ryId = '';
let copyId = '';

const SCENES: Scene[] = [
	{
		title: 'Put a gate on a wire',
		body: 'Drag a gate from the palette and drop it on a wire.',
		mobileBody: 'Tap a gate in the palette, then tap a spot on a wire.',
		run: () => placeFromPalette('H', 0, 0)
	},
	{
		title: 'Add a control dot',
		body: 'A Control dot dropped in an empty column waits there, faded, for a gate to join.',
		run: () => placeFromPalette('CONTROL', 1, 0)
	},
	{
		title: 'Give it a gate',
		body: 'Drop a gate in the same column and the dot controls it. This X becomes a CNOT, and with the H before it you have a Bell pair.',
		run: () => placeFromPalette('X', 1, 1)
	},
	{
		title: 'Place an angle gate',
		body: 'Double-click a palette gate to drop it in the next free column. Angle gates open a box for their angle.',
		mobileBody: 'Angle gates open a box for their angle as soon as they are placed.',
		run: async () => {
			const before = get(circuitIR);
			if (get(isMobile)) {
				await placeFromPalette('RY', 2, 0);
			} else {
				await moveTo(centre(paletteTile('RY')));
				await doubleClick();
				handleDoubleClick({ source: 'palette', gateType: 'RY' });
			}
			ryId = newOpId(before);
			await wait(500);
			await typeInto(angleBox(), 'pi/2');
			const apply = button('Apply');
			await moveTo(centre(apply), 500);
			await click();
			apply.click();
			await wait(300);
		}
	},
	{
		title: 'Change an angle later',
		body: 'Right-click an angle gate to edit it. Type an angle like `pi/4` and press `Enter`.',
		mobileBody: 'Press and hold an angle gate to edit it. Type an angle like `pi/4`.',
		run: async () => {
			await moveTo(centre(gateEl(ryId)));
			if (get(isMobile)) await holdPress();
			else await gesture('Right-click', click);
			editGateRequest.set(ryId);
			await wait(450);
			const input = angleBox();
			await typeInto(input, 'pi/4');
			await keys(['Enter'], 500);
			input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
			await wait(300);
		}
	},
	{
		title: 'Move a gate',
		body: 'Drag a gate on the board to move it.',
		mobileBody: 'Tap a gate to pick it up, then tap where it should go.',
		run: async () => {
			const el = gateEl(ryId);
			if (get(isMobile)) {
				await moveTo(centre(el));
				await gesture('Tap', click);
				await moveTo(cell(2, 1), 800);
				await gesture('Tap', click);
				selectedGateIds.set(new Set());
			} else {
				await drag(el, cell(2, 1));
			}
			drop({ source: 'wire', gateId: ryId }, 2, 1);
			await wait(300);
		}
	},
	{
		title: 'Copy a gate',
		body: 'Hold `Ctrl` (`⌘` on a Mac) as you start dragging, and you drop a copy instead.',
		desktopOnly: true,
		run: async () => {
			const before = get(circuitIR);
			const hId = before.operations.find((op) => op.gate === 'h')?.id ?? '';
			const el = gateEl(hId);
			await moveTo(centre(el));
			setHand({ keys: ['Ctrl'] });
			await press();
			setHand({ carrying: carryCopy(el) });
			await moveTo(cell(3, 0), 900);
			setHand({ carrying: null, keys: [] });
			await release();
			drop({ source: 'wire', gateId: hId, isCopy: true }, 3, 0);
			copyId = newOpId(before);
			await wait(300);
		}
	},
	{
		title: 'Select a group',
		body: 'Drag on empty space to draw a box. Every gate it touches is selected.',
		desktopOnly: true,
		run: async () => {
			const w = get(circuitLayout).columnWidth;
			const a = cell(2, 0);
			const b = cell(3, 1);
			const from = { x: a.x - w * 0.48, y: a.y - 26 };
			const to = { x: b.x + w * 0.48, y: b.y + 26 };
			await moveTo(from);
			await press();
			isDragSelecting.set(true);
			dragStart.set(from);
			dragCurrent.set(from);
			await moveTo(to, 1000, (p) => dragCurrent.set(p));
			// The same test the real box uses: a gate is in if it overlaps the box.
			const picked = new Set<string>();
			document.querySelectorAll('[data-tour="board"] [data-gate-id]').forEach((g) => {
				const r = g.getBoundingClientRect();
				if (r.right > from.x && r.left < to.x && r.bottom > from.y && r.top < to.y) {
					picked.add(g.getAttribute('data-gate-id') ?? '');
				}
			});
			isDragSelecting.set(false);
			dragStart.set(null);
			dragCurrent.set(null);
			selectedGateIds.set(picked);
			await release();
			await wait(400);
		}
	},
	{
		title: 'Delete',
		body: 'Press `Delete` to remove everything selected. (Double-clicking a gate removes just that one.)',
		mobileBody: 'Tap gates to select them, then tap the red Delete button.',
		run: async () => {
			if (get(isMobile)) {
				await moveTo(centre(gateEl(ryId)));
				await gesture('Tap', click);
				toggleGateSelection(ryId);
				await wait(300);
				const del = button('Delete selected gates');
				await moveTo(centre(del), 600);
				await click();
				del.click();
			} else {
				await keys(['Delete']);
				deleteSelectedGates();
			}
			await wait(400);
		}
	},
	{
		title: 'Undo',
		body: '`Ctrl`+`Z` brings it back. `Ctrl`+`Shift`+`Z` or `Ctrl`+`Y` redoes.',
		mobileBody: 'The undo and redo buttons bring it back, or redo it.',
		run: async () => {
			if (get(isMobile)) {
				const u = button('Undo');
				await moveTo(centre(u));
				await click();
				u.click();
			} else {
				await keys(['Ctrl', 'Z']);
				undo();
			}
			await wait(500);
		}
	},
	{
		title: 'Move everything at once',
		body: 'These arrows slide every gate one column left or right, to make room at the start.',
		run: async () => {
			const right = button('Move all gates one column right');
			await moveTo(centre(right), 800);
			await click();
			right.click();
			await wait(600);
		}
	},
	{
		title: 'Remove with a double-click',
		body: 'Double-click a gate on the board to remove it.',
		desktopOnly: true,
		run: async () => {
			await moveTo(centre(gateEl(copyId)));
			await doubleClick();
			handleDoubleClick({ source: 'wire', gateId: copyId });
			await wait(300);
		}
	},
	{
		title: 'Add a qubit',
		body: 'Use + to add a wire, − to take the last empty one off, or type how many you want.',
		run: async () => {
			const add = button('Add qubit');
			await moveTo(centre(add), 800);
			await click();
			add.click();
			await wait(500);
		}
	}
];

// Roughly the time it takes to read a caption before the hand starts.
const readTime = (text: string) => 700 + text.length * 14;

// ── Running it ───────────────────────────────────────────────

type Saved = {
	history: HistorySnapshot;
	pending: Map<number, number[]>;
	antiPending: Map<number, number[]>;
	selection: Set<string>;
};

function closeEditBox() {
	// The edit box closes on Esc. It may still be open if the demo was stopped
	// while it was typing.
	document
		.querySelector('.gate-ctx-menu')
		?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

function putBack(saved: Saved) {
	closeEditBox();
	armedGate.set(null);
	editGateRequest.set(null);
	isDragSelecting.set(false);
	dragStart.set(null);
	dragCurrent.set(null);
	pendingControls.set(saved.pending);
	pendingAntiControls.set(saved.antiPending);
	restoreHistory(saved.history); // puts the circuit back and re-simulates it
	selectedGateIds.set(saved.selection);
}

export async function startBoardDemo() {
	if (get(demoRunning)) return;
	activeRun = ++runId;

	const saved: Saved = {
		history: snapshotHistory(),
		pending: get(pendingControls),
		antiPending: get(pendingAntiControls),
		selection: get(selectedGateIds)
	};
	demoRunning.set(true);

	try {
		// A clean two-qubit board to play on. Its own undo history starts empty,
		// so the demo's undo can never reach into the user's steps.
		const board = document.querySelector('[data-tour="board"]');
		board?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		const clean: CircuitIR = {
			...get(circuitIR),
			registers: { q: 2, c: 2 },
			qubitLabels: ['Qubit 0', 'Qubit 1'],
			operations: []
		};
		closeEditBox();
		armedGate.set(null);
		pendingControls.set(new Map());
		pendingAntiControls.set(new Map());
		selectedGateIds.set(new Set());
		circuitIR.set(clean);
		resetHistory(clean);
		triggerSimulation(clean);

		const mobile = get(isMobile);
		const scenes = SCENES.filter((s) => !(mobile && s.desktopOnly));

		// The hand starts in the middle of the board.
		const start = board ? centre(board) : { x: innerWidth / 2, y: innerHeight / 2 };
		hand.set({ ...HIDDEN_HAND, ...start, visible: true });
		await wait(400);

		for (const [i, scene] of scenes.entries()) {
			const body = (mobile && scene.mobileBody) || scene.body;
			caption.set({ title: scene.title, body, index: i, count: scenes.length });
			await wait(readTime(body));
			await scene.run();
			checkRunning();
			await wait(900);
		}

		caption.set({
			title: 'That is the board',
			body: 'Your own circuit comes back now, exactly as you left it.',
			index: scenes.length,
			count: scenes.length
		});
		await wait(1800);
	} catch (err) {
		if (!(err instanceof Stopped)) console.error(err);
	} finally {
		putBack(saved);
		hand.set({ ...HIDDEN_HAND });
		caption.set(null);
		demoRunning.set(false);
	}
}
