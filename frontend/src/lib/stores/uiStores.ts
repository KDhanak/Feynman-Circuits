import { writable } from 'svelte/store';
import { COLUMN_WIDTH, MAX_COLUMNS } from '../utils/constants';
import type { GateData } from '../IR/schema';

// UI drag state
export const isDragging = writable<boolean>(false);

// Mobile tap-to-place: the gate selected by tapping it in the palette. While it is
// set, the drop zones light up and tapping one places this gate. Null = nothing selected.
export const armedGate = writable<GateData | null>(null);

// Layout settings (not IR data, just sizes for the UI). Only WireDropeZone
// changes this. It sets the column width to fit the centre panel.
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

// The column picked in the step-by-step results view. The board highlights it.
// Null when that view is not open.
export const selectedStepColumn = writable<number | null>(null);

// Which explanation popup is open: a container's "i" badge (Tooltip) or an
// underlined label (InfoText). They share this, so only one is open at a time.
export const openTooltip = writable<symbol | null>(null);
