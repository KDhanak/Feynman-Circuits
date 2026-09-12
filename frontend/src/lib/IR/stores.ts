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

// Whether the circuit on the board is public (shared through the public API).
//
// We store this directly instead of working it out from circuitListCache,
// because that cache only holds the first page. A circuit opened with
// "Load more" would then wrongly look private.
//
// False for anything the signed-in user does not own, including a public
// circuit they opened from someone else's share link. The board should never
// make it look like the visitor made it public.
export const currentCircuitIsPublic = writable<boolean>(false);
