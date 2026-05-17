import { writable } from "svelte/store";
import type { CircuitIR, SimulationResult } from "./schema";

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
    probabilities: {'0': 1, '1': 0},
    formattedState: '1.00|0⟩',
    blochVectors: [{ qubit: 0, x: 0, y: 0, z: 1, magnitude: 1}]
});

export const isDragging = writable<boolean>(false);

export const circuitLayout = writable({
	columnWidth: 58,
	gateOffset: 120,
	usableWidth: 1000,
});

export const showCircuitDataModal = writable<boolean>(false);
export const circuitDataModalContent = writable<string>('');

export const notification = writable<{ message: string; type: 'success' | 'error' } | null>(null);
