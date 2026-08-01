import { writable } from 'svelte/store';
import { COLUMN_WIDTH, MAX_COLUMNS } from '../utils/constants';
import type { GateData } from '../IR/schema';

// UI drag state
export const isDragging = writable<boolean>(false);

// Mobile tap-to-place: the gate "armed" by tapping it in the palette. While set,
// dropzones highlight and a tap on one places this gate. Null = nothing armed.
export const armedGate = writable<GateData | null>(null);

// Layout configuration (not IR data, just UI geometry). Owned solely by
// WireDropeZone, which fits the column width to the centre panel.
export const circuitLayout = writable({
	columnWidth: COLUMN_WIDTH,
	// Full pixel width of the gate track (all columns). Used to give the wire
	// rows an explicit min-width so the board can scroll horizontally.
	totalWidth: MAX_COLUMNS * COLUMN_WIDTH
});

// Toast notification
export const notification = writable<{ message: string; type: 'success' | 'error' } | null>(null);

// Auto-save status
export const saveStatus = writable<'idle' | 'saving' | 'saved' | 'error'>('idle');
