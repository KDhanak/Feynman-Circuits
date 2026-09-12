import { writable, derived, get } from 'svelte/store';
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
		if (get(theme) === 'system') applyResolved(resolve('system'));
	});
} else {
	applyResolved(resolve(getInitial()));
}

export function setTheme(pref: ThemePreference) {
	theme.set(pref);
}

export function toggleTheme() {
	// Header button: switch between light and dark, and save it as the user's choice.
	theme.update((pref) => (resolve(pref) === 'dark' ? 'light' : 'dark'));
}
