import { type GateType } from "$lib/stores";
import { type Complex, createComplex } from "./complex";

export interface QuantumGate {
    type: GateType;
    matrix: Complex[][];
};

export const X_GATE: QuantumGate = {
    type: "X",
    matrix: [
        [createComplex(0, 0), createComplex(1, 0)], // [0, 1]
        [createComplex(1, 0), createComplex(0, 0)], // [1, 0]
    ],
};

export const Y_GATE: QuantumGate = {
    type: "Y",
    matrix: [
        [createComplex(0, 0), createComplex(0, -1)], // [0, -i]
        [createComplex(0, 1), createComplex(0, 0)], // [i, 0]
    ],
};

export const Z_GATE: QuantumGate = {
    type: "Z",
    matrix: [
        [createComplex(1, 0), createComplex(0, 0)], // [1, 0]
        [createComplex(0, 0), createComplex(-1, 0)], // [0, -1]
    ],
};

export const H_GATE: QuantumGate = {
    type: "H",
    matrix: [
        [createComplex(1 / Math.sqrt(2), 0), createComplex(1 / Math.sqrt(2), 0)], // [1/sqrt(2), 1/sqrt(2)]
        [createComplex(1 / Math.sqrt(2), 0), createComplex(-1 / Math.sqrt(2), 0)], // [1/sqrt(2), -1/sqrt(2)]
    ],
};

export const S_GATE: QuantumGate = {
    type: "S",
    matrix: [
        [createComplex(1, 0), createComplex(0, 0)], // [1, 0]
        [createComplex(0, 0), createComplex(0, 1)], // [0, i]
    ],
};

export const T_GATE: QuantumGate = {
    type: "T",
    matrix: [
        [createComplex(1, 0), createComplex(0, 0)], // [1, 0]
        [createComplex(0, 0), createComplex(Math.cos(Math.PI / 4), Math.sin(Math.PI / 4))], // [0, e^(i pi/4)]
    ],
};

export const GATE_MAP: Record<GateType, QuantumGate> = {
    "X": X_GATE,
    "Y": Y_GATE,
    "Z": Z_GATE,
    "H": H_GATE,
    "S": S_GATE,
    "T": T_GATE,
}
