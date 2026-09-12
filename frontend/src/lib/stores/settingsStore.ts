import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type ResultView = 'list' | 'histogram';

// How basis-state labels are written in the results panel. Inside, the simulator
// always uses the same bit order (q0 is the smallest bit). This setting only
// flips the label text before showing it. It never changes the simulation or
// the wire layout.
//   'q0-right' — Qiskit/OpenQASM style, q0 is the rightmost bit (default)
//   'q0-left'  — textbook style, q0 is the leftmost bit
export type BitOrder = 'q0-right' | 'q0-left';

// Where the code (CircuitDataPanel) sits on wide screens (≥1024px):
//   'bottom' — in the results row beneath the circuit board (default)
//   'left'   — a tall full-height panel on the left, better for reading code
// Ignored below 1024px, where the panel is always at the bottom.
export type CodePanelPosition = 'bottom' | 'left';

export type Settings = {
	// Editing
	autoSaveEnabled: boolean;
	autoSaveIntervalMs: number;
	// Visualization
	defaultResultView: ResultView;
	probabilityDecimals: number;
	showBlochSphere: boolean;
	bitOrder: BitOrder;
	codePanelPosition: CodePanelPosition;
	// Wanted width (px) of the code panel when it is on the left. CSS keeps it within limits for each screen size.
	codePanelWidthPx: number;
	// Wanted height (px) of the results row below the board. Only used on
	// wide screens (≥1024px), where the board grows or shrinks to fill the rest.
	resultsRowHeightPx: number;
};

export const DEFAULT_SETTINGS: Settings = {
	autoSaveEnabled: true,
	autoSaveIntervalMs: 10_000,
	defaultResultView: 'list',
	probabilityDecimals: 2,
	showBlochSphere: true,
	bitOrder: 'q0-right',
	codePanelPosition: 'bottom',
	codePanelWidthPx: 480,
	// 330px is the same as the fixed 20.625rem the row used to have.
	resultsRowHeightPx: 330
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
		// Merge, so any newly added settings get their default values.
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
