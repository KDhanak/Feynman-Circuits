import { type BlochVector } from "../quantum/bloch";

export type CanonicalUnitaryGate = 'x' | 'y' | 'z' | 'h' | 's' | 't' | 'p' | 'rx' | 'ry' | 'rz' | 'swap';

export type OperationKind = 'unitary' | 'measure' | 'reset' | 'barrier';

export interface BaseOperation {
    id: string;
    kind: OperationKind;
    gate: string;
    column: number;
}

export interface UnitaryOperation extends BaseOperation {
    kind: 'unitary';
    gate: CanonicalUnitaryGate;
    targets: number[];
    controls: number[];
    antiControls: number[];
    params: number[];
}

export interface MeasureOperation extends BaseOperation {
    kind: 'measure';
    targets: number[];
    classicalTargets: number[];
}

export interface ResetOperation extends BaseOperation {
    kind: 'reset';
    targets: number[];
}

export interface BarrierOperation extends BaseOperation {
    kind: 'barrier';
    targets: number[];
}

export type CircuitOperation = UnitaryOperation | MeasureOperation | ResetOperation | BarrierOperation;

export interface CircuitIR {
    version: '1.0';
    registers: {
        q: number;
        c: number;
    };
    qubitLabels: string[];
    operations: CircuitOperation[];
}

export interface SimulationResult {
    probabilities: { [state: string]: number };
    formattedState?: string;
    formattedQuantumStateApproximate?: string;
    formattedStatePolar?: string;
    blochVectors?: BlochVector[];
    measuredQubits?: number[];
    classicalBits?: Map<number, number>;
};

export interface GateData {
    source: 'palette' | 'wire';
    gateType?: string;
    gateId?: string;
    isCopy?: boolean;
    qubit?: number;
};

export interface ErrorResponse {
    detail?: string;
};
