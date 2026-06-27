import { writable } from 'svelte/store';
import { COLUMN_WIDTH, GATE_OFFSET, MAX_COLUMNS } from '../utils/constants';
import type { GateData } from '../IR/schema';

// UI drag state
export const isDragging = writable<boolean>(false);

// Mobile tap-to-place: the gate "armed" by tapping it in the palette. While set,
// dropzones highlight and a tap on one places this gate. Null = nothing armed.
export const armedGate = writable<GateData | null>(null);

// Layout configuration (not IR data, just UI geometry)
export const circuitLayout = writable({
	columnWidth: COLUMN_WIDTH,
	gateOffset: GATE_OFFSET,
	usableWidth: 1000,
	// Full pixel width of the circuit (offset + all columns). Used to give the
	// wire rows an explicit min-width so the board can scroll horizontally.
	totalWidth: GATE_OFFSET + MAX_COLUMNS * COLUMN_WIDTH,
});

// Circuit data modal state
export const showCircuitDataModal = writable<boolean>(false);
export const circuitDataModalContent = writable<string>('');

// Toast notification
export const notification = writable<{ message: string; type: 'success' | 'error' } | null>(null);

// Auto-save status
export const saveStatus = writable<'idle' | 'saving' | 'saved' | 'error'>('idle');
