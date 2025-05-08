import {writable} from 'svelte/store'; // Import the writable function from Svelte's store module

// Defines a TypeScript interface for a quantum gate with an ID, type (e.g., X gate), and target qubit.
export interface GateInstance {
    id: string;
    gateType: 'X';
    qubit: number;
};

// Defines a TypeScript interface for the quantum circuit’s state, including the number of qubits and an array of gates.
export interface CircuitState {
    numQubits: number;
    gates: GateInstance[];
};

// Defines a TypeScript interface for simulation results, mapping quantum states to their probabilities.
export interface SimulationResult {
    probabilities: { [state: string]: number };
};


// Creates a writable store for the quantum circuit state, initialized with one qubit and no gates.
// Provides a reactive store to manage the circuit’s configuration, allowing components to subscribe and update the UI when users add qubits or gates.
export const circuit = writable<CircuitState>({
    numQubits: 1,
    gates: [],
});

export const SimulationResults = writable<SimulationResult | null>(null);

export function resetCircuit() {
    circuit.set({
        numQubits: 1,
        gates: [],
    });
    SimulationResults.set(null);
}

