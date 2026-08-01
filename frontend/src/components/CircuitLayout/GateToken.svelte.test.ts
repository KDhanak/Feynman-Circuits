import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import type { ComponentProps } from 'svelte';
import GateToken from './GateToken.svelte';
import type { UnitaryOperation } from '$lib/IR/schema';

import { LONG_PRESS_MS, MOVE_TOLERANCE } from '$lib/circuit/touchUtils';

function makeGate(gate: string): UnitaryOperation {
	return {
		id: 'gate-1',
		kind: 'unitary',
		gate: gate as UnitaryOperation['gate'],
		column: 0,
		targets: [0],
		controls: [],
		antiControls: [],
		params: [Math.PI / 2]
	};
}

// jsdom has no TouchEvent constructor, so fake the one field the handlers read.
function touch(type: string, x: number, y: number) {
	const e = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperty(e, 'touches', { value: [{ clientX: x, clientY: y }] });
	return e;
}

function setup(gate: string) {
	const onMenu = vi.fn();
	// Svelte 5 dropped `component.$on`; createEventDispatcher now reads its
	// listeners from the `$$events` prop, which is how a legacy `on:` directive
	// on the parent is passed down.
	const props = {
		op: makeGate(gate),
		qubit: 0,
		columnWidth: 60,
		$$events: { gatecontextmenu: onMenu }
	};
	const { container } = render(GateToken, {
		props: props as unknown as ComponentProps<typeof GateToken>
	});
	const el = container.querySelector('[data-type="GATE"]') as HTMLElement;
	return { el, onMenu };
}

describe('GateToken long-press to edit', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	for (const gate of ['rx', 'ry', 'rz', 'p', 'swap']) {
		it(`opens the editor after holding a ${gate.toUpperCase()} gate`, () => {
			const { el, onMenu } = setup(gate);
			el.dispatchEvent(touch('touchstart', 10, 10));
			vi.advanceTimersByTime(LONG_PRESS_MS);
			expect(onMenu).toHaveBeenCalledTimes(1);
			expect(onMenu.mock.calls[0][0].detail.gate.gate).toBe(gate);
		});
	}

	it('does nothing for a gate with no editable parameter', () => {
		const { el, onMenu } = setup('h');
		el.dispatchEvent(touch('touchstart', 10, 10));
		vi.advanceTimersByTime(LONG_PRESS_MS * 2);
		expect(onMenu).not.toHaveBeenCalled();
	});

	it('does not fire on a short tap', () => {
		const { el, onMenu } = setup('rx');
		el.dispatchEvent(touch('touchstart', 10, 10));
		vi.advanceTimersByTime(LONG_PRESS_MS - 50);
		el.dispatchEvent(touch('touchend', 10, 10));
		vi.advanceTimersByTime(LONG_PRESS_MS);
		expect(onMenu).not.toHaveBeenCalled();
	});

	it('cancels when the finger drifts past the tolerance (board scroll)', () => {
		const { el, onMenu } = setup('rx');
		el.dispatchEvent(touch('touchstart', 10, 10));
		el.dispatchEvent(touch('touchmove', 10, 10 + MOVE_TOLERANCE + 5));
		vi.advanceTimersByTime(LONG_PRESS_MS);
		expect(onMenu).not.toHaveBeenCalled();
	});

	it('tolerates small jitter while holding still', () => {
		const { el, onMenu } = setup('rx');
		el.dispatchEvent(touch('touchstart', 10, 10));
		el.dispatchEvent(touch('touchmove', 12, 13));
		vi.advanceTimersByTime(LONG_PRESS_MS);
		expect(onMenu).toHaveBeenCalledTimes(1);
	});

	it('swallows the click that ends the long press, so the menu is not closed again', () => {
		const { el, onMenu } = setup('rx');
		const boardListener = vi.fn(); // stands in for the board's close-on-click-outside
		document.addEventListener('click', boardListener);

		el.dispatchEvent(touch('touchstart', 10, 10));
		vi.advanceTimersByTime(LONG_PRESS_MS);
		el.dispatchEvent(touch('touchend', 10, 10));
		el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

		expect(onMenu).toHaveBeenCalledTimes(1);
		expect(boardListener).not.toHaveBeenCalled();
		document.removeEventListener('click', boardListener);
	});

	it('stops swallowing clicks once the press is over', () => {
		const { el } = setup('rx');
		const boardListener = vi.fn();
		document.addEventListener('click', boardListener);

		el.dispatchEvent(touch('touchstart', 10, 10));
		vi.advanceTimersByTime(LONG_PRESS_MS);
		el.dispatchEvent(touch('touchend', 10, 10));
		el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); // swallowed
		el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); // must pass

		expect(boardListener).toHaveBeenCalledTimes(1);
		document.removeEventListener('click', boardListener);
	});
});
