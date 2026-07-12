import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type ResultView = 'list' | 'histogram';

export type Settings = {
	// Editing
	autoSaveEnabled: boolean;
	autoSaveIntervalMs: number;
	// Visualization
	defaultResultView: ResultView;
	probabilityDecimals: number;
	showBlochSphere: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
	autoSaveEnabled: true,
	autoSaveIntervalMs: 10_000,
	defaultResultView: 'list',
	probabilityDecimals: 2,
	showBlochSphere: true
};

export const AUTO_SAVE_INTERVAL_OPTIONS = [
	{ label: '5 seconds', value: 5_000 },
	{ label: '10 seconds', value: 10_000 },
	{ label: '30 seconds', value: 30_000 },
	{ label: '1 minute', value: 60_000 }
];

export const PROBABILITY_DECIMAL_OPTIONS = [1, 2, 3, 4];

const STORAGE_KEY = 'app-settings';

function getInitial(): Settings {
	if (!browser) return { ...DEFAULT_SETTINGS };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_SETTINGS };
		// Merge so newly-added settings fall back to defaults.
		return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

export const settings = writable<Settings>(getInitial());

if (browser) {
	settings.subscribe((s) => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
	});
}

export function updateSettings(patch: Partial<Settings>) {
	settings.update((s) => ({ ...s, ...patch }));
}

export function resetSettings() {
	settings.set({ ...DEFAULT_SETTINGS });
}
