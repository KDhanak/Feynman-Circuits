import { writable } from 'svelte/store';
import type { CircuitIR, SimulationResult } from './schema';

export const circuitIR = writable<CircuitIR>({
	version: '1.0',
	registers: {
		q: 1,
		c: 0
	},
	qubitLabels: ['Qubit 0'],
	operations: []
});

export const simulationResult = writable<SimulationResult>({
	probabilities: { '0': 1, '1': 0 },
	formattedState: '1.00|0⟩',
	blochVectors: [{ qubit: 0, x: 0, y: 0, z: 1, magnitude: 1 }]
});

export const currentCircuitId = writable<string>('');
export const currentCircuitName = writable<string>('Untitled Circuit');

// Whether the circuit on the board is published through the public API.
//
// Held explicitly rather than derived from circuitListCache, which only caches
// the first page — a circuit opened via "Load more" would read as private.
//
// False for anything the signed-in user does not own, including a public
// circuit they arrived at through someone else's share link: the board should
// never suggest the visitor published it.
export const currentCircuitIsPublic = writable<boolean>(false);
