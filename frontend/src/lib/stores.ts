// src/lib/stores.ts
import { writable } from 'svelte/store';

/**
 * Valid gate types for the quantum circuit.
 * Used in GateInstance for internal state and simulation.
 */
export type MatrixGateType = 'X' | 'Y' | 'Z' | 'H' | 'S' | 'T';
export type GateType = MatrixGateType | 'CONTROL';
export type QubitMode = 'single' | 'multi';

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
    /** Optional target qubit for gates like CNOT */
    targetQubit?: number;
    /** Optional array of target qubits for multi-controlled gates */
    targetQubits?: number[];
    /**The column of "time step" this gate belongs to */
    columnIndex: number;
};

/**
 * Represents the internal state of the quantum circuit.
 * Stored in the circuit store and used by the simulator.
 */
export interface CircuitState {
    /** Number of qubits in the circuit (currently 1 for single qubit) */
    numQubits: number;
    /** Array of gates in the circuit */
    gates: GateInstance[];
    /** Optional labels for qubits, used in UI */
    qubitLabels?: string[];
    /** Optional field to record the mode of the circuit */
    mode?: QubitMode;
};

// Define the type for the drag data
// This is used to transfer data during drag-and-drop operations
export interface GateData {
    source: 'palette' | 'wire';
    gateType?: string; // Present if source is 'palette'
    gateId?: string; // Present if source is 'wire'
};

/**
 * Result of a quantum circuit simulation.
 * Contains probabilities of measuring each state (e.g., |0⟩, |1⟩).
 */
export interface SimulationResult {
    probabilities: { [state: string]: number };
    formattedState?: string;
    formattedQuantumStateApproximate?: string;
    formattedStatePolar?: string;
};

/**
 * Represents a gate imported from an external source.
 * Used in the import functionality to convert to CircuitState.
 */
export interface ImportedGate {
    gate: GateType;
    qubit: number;
    columnIndex: number;
    targetQubit?: number;
    targetQubits?: number[];
};

/**
 * Represents a circuit imported from an external source.
 * Used in the import functionality to convert to CircuitState.
 */
export interface ImportedCircuit {
    qubitLabels?: [];
    gates: ImportedGate[];
    numQubits: number;
    mode?: QubitMode;
};

/**
 * Represents an error response for invalid circuit imports.
 * Contains a detail message describing the error.
 */
export interface ErrorResponse {
    detail?: string;
};

/**
 * Store for the quantum circuit state.
 * Contains the number of qubits and an array of gate instances.
 */
export const circuit = writable<CircuitState>({
    numQubits: 1,
    gates: [],
    qubitLabels: ['Qubit 0'],
    mode: 'single',
});

/**
 * Store for the results of the quantum circuit simulation.
 * Contains probabilities of measuring each state and formatted representations.
 */
export const SimulationResults = writable<SimulationResult>({
    probabilities: { '0': 1, '1': 0 },
    formattedState: '1.00|0⟩',
});

/**
 * Store to track if a gate is currently being dragged.
 * Used to display ghost qubit wires for dynamic qubit expansion.
 */
export const isDragging = writable<boolean>(false);

/** function for switch between single and multi qubit mode. */
export function toggleMode(backToCount: number = 2) {
    circuit.update(c => {
        const newCount = c.numQubits === 1 ? backToCount : 1;
        return {
            ...c,
            numQubits: newCount,
            qubitLabels: Array.from({ length: newCount }, (_, i) => `Qubit ${i}`)
        };
    });
};

/**
 * Store for the current state of the quantum circuit.
 */
export function setNumQubits(n: number) {
    circuit.update(c => ({
        ...c,
        numQubits: n,
        qubitLabels: Array.from({ length: n }, (_, i) => `Qubit ${i}`),
    }));
};

