export interface GateInput {
    gate: String;
    targetQubit: number;
    controlQubit: number;
}

export interface CircuitInput {
    gate: GateInput;
    numQubits: number;
}

export interface ErrorResponse {
    detail?: string;
}

export type SimulationResult = string[];
