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

/**
 * Result of a quantum circuit simulation.
 * Contains probabilities of measuring each state (e.g., |0⟩, |1⟩).
 */
export interface SimulationResult {
    probabilities: { [state: string]: number };
    formattedState?: string;
    formattedStatePolar?: string;
}

export const circuit = writable<CircuitState>({
    numQubits: 1,
    gates: [],
});

export const SimulationResults = writable<SimulationResult>({
    probabilities: { '0': 1, '1': 0 }
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
