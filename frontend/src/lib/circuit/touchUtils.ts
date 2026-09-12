/*
 * Touch gesture helpers for the circuit board.
 *
 * Touch screens have no right-click, so pressing and holding is used instead. We
 * build this ourselves instead of using the browser's own long press, because
 * the gate tokens are `draggable`, and different browsers react to a hold in
 * different ways: starting a drag, showing a text-selection popup, or opening
 * their own menu.
 */

// How long a finger must stay down before the press counts as a long press.
export const LONG_PRESS_MS = 500;

// How far the finger can move and still count as holding instead of scrolling.
export const MOVE_TOLERANCE = 10;

// How long to wait for the click that ends a long press. After this we stop
// waiting to block it, so a later, unrelated click is never blocked by mistake.
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
	 * True between touchstart and touchend. Android fires `contextmenu` in the
	 * middle of a long press. Callers check this to block that event, so a touch
	 * opens the menu in only one way.
	 */
	isTouchActive: () => boolean;
}

/**
 * Builds a set of touch handlers for press-and-hold. Each call keeps its own
 * state, so use one per component.
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
			e.preventDefault(); // stop the fake mouse events the browser would create for this tap
		}
	}

	return { onTouchStart, onTouchMove, onTouchEnd, cancel, isTouchActive: () => touchActive };
}

/**
 * Blocks the next click, only once. The tap that ends a long press still
 * creates a click. Without this, that click would reach the element being held
 * (and select it) and also any "click outside to close" handler, which would
 * close the menu the press just opened. Stops waiting after a short time, so a
 * later, unrelated click is never blocked.
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
