export type CanonicalUnitaryGate = 'x' | 'y' | 'z' | 'h' | 's' | 't';

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
