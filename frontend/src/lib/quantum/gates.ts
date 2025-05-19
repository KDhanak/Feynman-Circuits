import { type GateType } from "$lib/stores";
import { type Complex, createComplex } from "./complex";

export interface QuantumGate {
    type: GateType;
    matrix: Complex[][];
};

export const X_GATE: QuantumGate = {
    type: "X",
    matrix: [
        [createComplex(0, 0), createComplex(1, 0)],
        [createComplex(1, 0), createComplex(0, 0)],
    ],
};

export const H_GATE: QuantumGate = {
    type: "H",
    matrix: [
        [createComplex(1 / Math.sqrt(2), 0), createComplex(1 / Math.sqrt(2), 0)],
        [createComplex(1 / Math.sqrt(2), 0), createComplex(-1 / Math.sqrt(2), 0)],
    ],
};

export const Z_GATE: QuantumGate = {
    type: "Z",
    matrix: [
        [createComplex(1, 0), createComplex(0, 0)],
        [createComplex(0, 0), createComplex(-1, 0)],
    ],
};

export const GATE_MAP: Record<GateType, QuantumGate> = {
    "X": X_GATE,
    "H": H_GATE,
    "Z": Z_GATE,
}
