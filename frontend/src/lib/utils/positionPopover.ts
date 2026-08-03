/**
 * Places a floating panel next to an anchor element, clamped into the viewport.
 *
 * Extracted from Tooltip so the onboarding coach marks reuse exactly the same
 * flip-and-clamp behaviour — a tooltip near the bottom of the board and a coach
 * mark on the same element should land in the same place.
 *
 * Coordinates are viewport-relative, so the caller applies them with
 * `position: fixed`.
 */

export type PopoverGeometry = {
	left: number;
	top: number;
	width: number;
	/** Which side of the anchor we ended up on — callers use it to point an arrow. */
	side: 'below' | 'above';
};

export type PopoverOptions = {
	/** Upper bound on width; always shrinks to fit narrow viewports. */
	maxWidth?: number;
	/** Minimum gap kept from every viewport edge. */
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

	// Horizontal: centre on the anchor, then clamp so neither side spills
	// off-screen — effectively flips to whichever side has room.
	let left = anchor.left + anchor.width / 2 - width / 2;
	left = Math.max(margin, Math.min(left, vw - width - margin));

	// Vertical: prefer below the anchor; flip above when there isn't room.
	let top: number;
	let side: 'below' | 'above';
	if (anchor.bottom + gap + panelHeight + margin <= vh) {
		top = anchor.bottom + gap;
		side = 'below';
	} else if (anchor.top - gap - panelHeight - margin >= 0) {
		top = anchor.top - gap - panelHeight;
		side = 'above';
	} else {
		// Doesn't fully fit either side — clamp into view. Happens when the anchor
		// is nearly as tall as the viewport, e.g. the circuit board on a laptop.
		top = Math.max(margin, Math.min(vh - panelHeight - margin, anchor.bottom + gap));
		side = 'below';
	}

	return { left, top, width, side };
}
