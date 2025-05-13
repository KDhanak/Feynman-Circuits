import { writable } from 'svelte/store';

// Define the possible gate types as a union of string literals
export type GateType = 'X' | 'H' | 'Z' | 'CNOT';

// Interface for a quantum gate instance
export interface GateInstance {
    id: string;
    gateType: GateType; // Use gateType instead of gateData, with a union type
    qubit: number;
}

// Interface for the quantum circuit's state
export interface CircuitState {
    numQubits: number;
    gates: GateInstance[];
}

// Interface for simulation results
export interface SimulationResult {
    probabilities: { [state: string]: number };
}

// Writable store for the circuit state
export const circuit = writable<CircuitState>({
    numQubits: 1,
    gates: [],
});

// Writable store for simulation results, initialized with default probabilities
export const SimulationResults = writable<SimulationResult>({
    probabilities: { '0': 1, '1': 0 } // Default state for a single qubit
});

export function resetCircuit() {
    circuit.set({
        numQubits: 1,
        gates: [],
    });
    SimulationResults.set({
        probabilities: { '0': 1, '1': 0 }
    });
}
