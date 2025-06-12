// src/lib/stores.ts
import { writable } from 'svelte/store';

/**
 * Valid gate types for the quantum circuit.
 * Used in GateInstance for internal state and simulation.
 */
export type GateType = 'X' | 'Y' | 'Z' | 'H' | 'S' | 'T';

/**
 * Represents a gate instance in the internal circuit state.
 * Used in the circuit store and simulator, with an ID for UI tracking.
 */
export interface GateInstance {
    /** Unique identifier for UI operations (e.g., drag-and-drop, removal) */
    id: string;
    /** Gate type, restricted to valid GateType values */
    gateType: GateType;
    /** Qubit index the gate acts on (e.g., 0 for single qubit) */
    qubit: number;
}

/**
 * Represents the internal state of the quantum circuit.
 * Stored in the circuit store and used by the simulator.
 */
export interface CircuitState {
    /** Number of qubits in the circuit (currently 1 for single qubit) */
    numQubits: number;
    /** Array of gates in the circuit */
    gates: GateInstance[];
}

// Define the type for the drag data
// This is used to transfer data during drag-and-drop operations
export interface GateData {
    source: 'palette' | 'wire';
    gateType?: string; // Present if source is 'palette'
    gateId?: string; // Present if source is 'wire'
}

/**
 * Result of a quantum circuit simulation.
 * Contains probabilities of measuring each state (e.g., |0⟩, |1⟩).
 */
export interface SimulationResult {
    probabilities: { [state: string]: number };
    formattedState?: string;
    formattedQuantumStateApproximate?: string;
    formattedStatePolar?: string;
}

export const circuit = writable<CircuitState>({
    numQubits: 1,
    gates: [],
});

export const SimulationResults = writable<SimulationResult>({
    probabilities: { '0': 1, '1': 0 },
    formattedState: '1.00|0⟩',
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
