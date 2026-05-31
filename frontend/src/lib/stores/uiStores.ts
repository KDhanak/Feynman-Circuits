import { writable } from 'svelte/store';
import { COLUMN_WIDTH, GATE_OFFSET } from '../utils/constants';

// UI drag state
export const isDragging = writable<boolean>(false);

// Layout configuration (not IR data, just UI geometry)
export const circuitLayout = writable({
	columnWidth: COLUMN_WIDTH,
	gateOffset: GATE_OFFSET,
	usableWidth: 1000,
});

// Circuit data modal state
export const showCircuitDataModal = writable<boolean>(false);
export const circuitDataModalContent = writable<string>('');

// Toast notification
export const notification = writable<{ message: string; type: 'success' | 'error' } | null>(null);
