// Interface for API input to specify a gate (if needed for an API)
export interface GateInput {
    gate: string; 
    targetQubit: number;
    controlQubit?: number;
}

// Interface for API input to specify a circuit (if needed for an API)
export interface CircuitInput {
    gates: GateInput[];
    numQubits: number;
}

// Interface for API error responses
export interface ErrorResponse {
    detail?: string;
}
