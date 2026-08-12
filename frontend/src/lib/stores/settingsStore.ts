import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type ResultView = 'list' | 'histogram';

// How basis-state labels are printed in the results panel. The engine always
// runs little-endian internally (q0 = LSB); this only reverses the label string
// before rendering — it never affects the simulation or the wire layout.
//   'q0-right' — Qiskit/OpenQASM convention, q0 is the right-most bit (default)
//   'q0-left'  — textbook convention, q0 is the left-most bit
export type BitOrder = 'q0-right' | 'q0-left';

// Where the code (CircuitDataPanel) sits on wide screens (≥1024px):
//   'bottom' — in the results row beneath the circuit board (default)
//   'left'   — a tall full-height panel on the left, better for reading code
// Ignored below 1024px, where it always falls back to the bottom slot.
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
	// Desired width (px) of the left-docked code panel; CSS clamps it responsively.
	codePanelWidthPx: number;
	// Desired height (px) of the results row beneath the board. Only applied on
	// wide screens (≥1024px), where the board flexes to absorb the difference.
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
	// 330px === the 20.625rem the row used to be hard-coded to.
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
