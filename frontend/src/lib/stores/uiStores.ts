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

// True for a moment after "Move all" shifts the circuit. While it is on, the
// board slides gates and connector lines to their new column instead of
// jumping. It is off the rest of the time, so a dragged gate still drops
// straight into place.
export const shiftingCircuit = writable<boolean>(false);

// True while the board demo is playing. The demo makes real edits on the board,
// so auto-save ignores the circuit while this is on: the demo's gates must
// never be saved over the user's circuit.
export const demoRunning = writable<boolean>(false);

// Which explanation popup is open: a container's "i" badge (Tooltip) or an
// underlined label (InfoText). They share this, so only one is open at a time.
export const openTooltip = writable<symbol | null>(null);
