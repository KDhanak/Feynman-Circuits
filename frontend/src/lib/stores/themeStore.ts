import { writable, derived, get } from 'svelte/store';
import { tick } from 'svelte';
import { browser } from '$app/environment';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

function systemPrefersDark(): boolean {
	return browser && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getInitial(): ThemePreference {
	if (!browser) return 'light';
	const stored = localStorage.getItem('theme');
	if (stored === 'light' || stored === 'dark' || stored === 'system') {
		return stored;
	}
	return 'light';
}

function resolve(pref: ThemePreference): ResolvedTheme {
	if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light';
	return pref;
}

function applyResolved(t: ResolvedTheme) {
	if (!browser) return;
	document.documentElement.classList.toggle('dark', t === 'dark');
}

// Holds the user's preference (may be 'system').
export const theme = writable<ThemePreference>(getInitial());

// The actual light/dark currently applied — use this for icons/visuals.
export const resolvedTheme = derived(theme, ($theme) => resolve($theme));

if (browser) {
	theme.subscribe((pref) => {
		localStorage.setItem('theme', pref);
		applyResolved(resolve(pref));
	});

	// Follow OS changes while in 'system' mode.
	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
		if (get(theme) === 'system') smoothly(() => applyResolved(resolve('system')));
	});
} else {
	applyResolved(resolve(getInitial()));
}

/**
 * Runs a theme change as one cross-fade.
 *
 * Without this, every element on the page fades its own colours (the
 * transition rule on * in app.css). That is thousands of separate animations
 * at once, so the switch stutters, and the code editor switches straight away
 * while the rest is still fading. A View Transition instead takes a picture of
 * the old page, makes the change, and fades the old picture into the new page.
 * The browser does that fade as one layer, so it stays smooth however big the
 * circuit is. While it runs, the per-element fades are turned off
 * (html.theme-switching in app.css).
 *
 * Browsers without View Transitions, and users who ask for reduced motion,
 * get the change straight away.
 */
function smoothly(change: () => void) {
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (!document.startViewTransition || reduceMotion) {
		change();
		return;
	}
	const root = document.documentElement;
	root.classList.add('theme-switching');
	const transition = document.startViewTransition(async () => {
		change();
		// Let Svelte redraw (the header icon, the code editor's theme) before the
		// new picture is taken.
		await tick();
	});
	transition.finished.finally(() => root.classList.remove('theme-switching'));
}

export function setTheme(pref: ThemePreference) {
	if (!browser || pref === get(theme)) return theme.set(pref);
	smoothly(() => theme.set(pref));
}

export function toggleTheme() {
	// Header button: switch between light and dark, and save it as the user's choice.
	setTheme(resolve(get(theme)) === 'dark' ? 'light' : 'dark');
}
