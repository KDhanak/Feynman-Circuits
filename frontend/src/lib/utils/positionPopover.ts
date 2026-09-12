/**
 * Places a floating panel next to an anchor element, and keeps it inside the screen.
 *
 * This was moved out of Tooltip so the onboarding coach marks use exactly the
 * same logic for flipping sides and staying on screen. A tooltip near the
 * bottom of the board and a coach mark on the same element should end up in
 * the same place.
 *
 * The coordinates are measured from the top-left of the screen, so the caller
 * uses them with `position: fixed`.
 */

export type PopoverGeometry = {
	left: number;
	top: number;
	width: number;
	/** Which side of the anchor the panel ended up on. Callers use it to point an arrow. */
	side: 'below' | 'above';
};

export type PopoverOptions = {
	/** Largest allowed width. It always shrinks to fit narrow screens. */
	maxWidth?: number;
	/** Smallest gap kept from every edge of the screen. */
	margin?: number;
	/** Gap between the anchor and the panel. */
	gap?: number;
};

export function positionPopover(
	anchor: DOMRect,
	panelHeight: number,
	opts: PopoverOptions = {}
): PopoverGeometry {
	const { maxWidth = 320, margin = 8, gap = 6 } = opts;

	const vw = window.innerWidth;
	const vh = window.innerHeight;

	const width = Math.min(maxWidth, vw - margin * 2);

	// Horizontal: centre it on the anchor, then push it back so neither side goes
	// off-screen. In effect, it moves to whichever side has room.
	let left = anchor.left + anchor.width / 2 - width / 2;
	left = Math.max(margin, Math.min(left, vw - width - margin));

	// Vertical: put it below the anchor if possible, or above if there isn't room.
	let top: number;
	let side: 'below' | 'above';
	if (anchor.bottom + gap + panelHeight + margin <= vh) {
		top = anchor.bottom + gap;
		side = 'below';
	} else if (anchor.top - gap - panelHeight - margin >= 0) {
		top = anchor.top - gap - panelHeight;
		side = 'above';
	} else {
		// It doesn't fully fit on either side, so just keep it on screen. This happens
		// when the anchor is almost as tall as the screen, e.g. the circuit board on a laptop.
		top = Math.max(margin, Math.min(vh - panelHeight - margin, anchor.bottom + gap));
		side = 'below';
	}

	return { left, top, width, side };
}
