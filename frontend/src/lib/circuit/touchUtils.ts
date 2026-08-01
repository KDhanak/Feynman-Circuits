/*
 * Touch gesture helpers for the circuit board.
 *
 * Touch has no right-click, so a hold stands in for it. This is implemented by
 * hand rather than leaning on the browser's native long press because the gate
 * tokens are `draggable`, and browsers variously answer a hold with a drag lift,
 * a text-selection callout, or their own context menu.
 */

// How long a finger must stay down before the press counts as a long press.
export const LONG_PRESS_MS = 500;

// How far the finger may drift and still count as holding rather than scrolling.
export const MOVE_TOLERANCE = 10;

// How long to wait for the click that ends a long press before giving up on
// swallowing it, so an unrelated click later is never eaten.
const CLICK_SUPPRESS_WINDOW_MS = 800;

export interface LongPressOptions {
	/** Fired once the hold completes. `target` is the element the press began on. */
	onLongPress: (target: HTMLElement) => void;
	/** Return false to ignore the press entirely (e.g. a gate with nothing to edit). */
	enabled?: () => boolean;
	durationMs?: number;
	moveTolerance?: number;
}

export interface LongPressHandlers {
	onTouchStart: (e: TouchEvent) => void;
	onTouchMove: (e: TouchEvent) => void;
	onTouchEnd: (e: TouchEvent) => void;
	cancel: () => void;
	/**
	 * True between touchstart and touchend. Android fires `contextmenu` partway
	 * through a long press; callers consult this to swallow it so touch takes
	 * exactly one path to the menu.
	 */
	isTouchActive: () => boolean;
}

/**
 * Builds a set of touch handlers implementing press-and-hold. Each call owns its
 * own state, so one instance per component instance.
 */
export function createLongPress(options: LongPressOptions): LongPressHandlers {
	const duration = options.durationMs ?? LONG_PRESS_MS;
	const tolerance = options.moveTolerance ?? MOVE_TOLERANCE;

	let timer: ReturnType<typeof setTimeout> | null = null;
	let start: { x: number; y: number } | null = null;
	let touchActive = false;
	let fired = false;

	function cancel() {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
		start = null;
	}

	function onTouchStart(e: TouchEvent) {
		if (options.enabled && !options.enabled()) return;
		if (e.touches.length !== 1) return; // ignore pinch/zoom
		const target = e.currentTarget as HTMLElement;
		const t = e.touches[0];
		touchActive = true;
		fired = false;
		start = { x: t.clientX, y: t.clientY };
		timer = setTimeout(() => {
			timer = null;
			fired = true;
			options.onLongPress(target);
			suppressNextClick();
		}, duration);
	}

	function onTouchMove(e: TouchEvent) {
		if (!start) return;
		const t = e.touches[0];
		if (!t) return;
		if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > tolerance) {
			cancel(); // the user is scrolling, not holding
		}
	}

	function onTouchEnd(e: TouchEvent) {
		cancel();
		touchActive = false;
		if (fired) {
			fired = false;
			e.preventDefault(); // stop the emulated mouse events this tap would produce
		}
	}

	return { onTouchStart, onTouchMove, onTouchEnd, cancel, isTouchActive: () => touchActive };
}

/**
 * Swallows the next click, once. The tap that ends a long press still produces a
 * click, which would otherwise reach both the element held (selecting it) and any
 * document-level close-on-click-outside handler — closing the very menu the press
 * just opened. Gives up after a short window so an unrelated click is never eaten.
 */
export function suppressNextClick() {
	const swallow = (ev: MouseEvent) => {
		ev.stopPropagation();
		ev.preventDefault();
		clearTimeout(giveUp);
	};
	document.addEventListener('click', swallow, { capture: true, once: true });
	const giveUp = setTimeout(
		() => document.removeEventListener('click', swallow, { capture: true }),
		CLICK_SUPPRESS_WINDOW_MS
	);
}
