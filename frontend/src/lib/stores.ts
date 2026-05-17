// src/lib/stores.ts
import { writable } from 'svelte/store';

/**
 * Represents an error response for invalid circuit imports.
 * Contains a detail message describing the error.
 */
export interface ErrorResponse {
    detail?: string;
};

/**
 * Store to track if a gate is currently being dragged.
 * Used to display ghost qubit wires for dynamic qubit expansion.
 */
export const isDragging = writable<boolean>(false);

export const circuitLayout = writable({
	columnWidth: 58,
	gateOffset: 120,
	usableWidth: 1000,
});
