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

function setup(gate: string, overrides: Partial<UnitaryOperation> = {}) {
	const onMenu = vi.fn();
	// Svelte 5 dropped `component.$on`; createEventDispatcher now reads its
	// listeners from the `$$events` prop, which is how a legacy `on:` directive
	// on the parent is passed down.
	const props = {
		op: { ...makeGate(gate), ...overrides },
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

describe('GateToken parameter display', () => {
	it.each([
		[Math.PI / 2, 'π/2'],
		[-Math.PI / 4, '-π/4'],
		[(3 * Math.PI) / 4, '3π/4'],
		[Math.PI, 'π'],
		[0, '0'],
		[1.234, '1.234'] // not a clean fraction of π — falls back to radians
	])('shows %f as %s on the token', (radians, shown) => {
		const { el } = setup('rx', { params: [radians] });
		expect(el.textContent).toContain('RX');
		expect(el.textContent).toContain(shown);
	});

	it('shows each parametric gate its own angle', () => {
		for (const gate of ['rx', 'ry', 'rz', 'p']) {
			const { el } = setup(gate, { params: [Math.PI / 2] });
			expect(el.textContent).toContain(gate.toUpperCase());
			expect(el.textContent).toContain('π/2');
		}
	});

	it('leaves a non-parametric gate unchanged', () => {
		const { el } = setup('h');
		expect(el.textContent?.trim()).toBe('H');
	});

	it('describes the angle in the title and accessible name', () => {
		const { el } = setup('rx', { params: [Math.PI / 2] });
		expect(el.getAttribute('title')).toBe('RX angle π/2');
		expect(el.getAttribute('aria-label')).toContain('RX angle π/2');
	});

	it('describes a SWAP by its target pair', () => {
		const { el } = setup('swap', { targets: [0, 2] });
		expect(el.getAttribute('title')).toBe('SWAP q0 ↔ q2');
	});

	it('gives a plain gate no title', () => {
		const { el } = setup('h');
		expect(el.getAttribute('title')).toBeNull();
	});
});

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
