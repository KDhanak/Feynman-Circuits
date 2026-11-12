// Gap kept between a dropdown and the edge of the window, in pixels.
const MARGIN = 8;

/**
 * Svelte action for a `.dropdown-menu`. A dropdown opens under the left edge
 * of its button, so a button near the right side of the window would push it
 * off the screen. When that happens, this lines the menu up with the button's
 * right edge instead, so it opens towards the left.
 */
export function keepInView(menu: HTMLElement) {
	const rect = menu.getBoundingClientRect();
	if (rect.right > window.innerWidth - MARGIN) {
		menu.style.left = 'auto';
		menu.style.right = '0';
	}
}
