import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

function getInitial(): Theme {
	if (!browser) return 'light';
	const stored = localStorage.getItem('theme');
	if (stored === 'light' || stored === 'dark') {
		return stored;
	}
	return 'light';
}

function applyTheme(t: Theme) {
	if (!browser) return;
	if (t === 'dark') {
		document.documentElement.classList.add('dark');
	} else {
		document.documentElement.classList.remove('dark');
	}
	localStorage.setItem('theme', t);
}

const initialTheme = getInitial();
export const theme = writable<Theme>(initialTheme);

applyTheme(initialTheme);
theme.subscribe(applyTheme);

export function toggleTheme() {
	theme.update(t => (t === 'dark' ? 'light' : 'dark'));
}
