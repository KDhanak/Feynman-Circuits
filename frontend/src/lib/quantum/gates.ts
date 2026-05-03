import type { CanonicalUnitaryGate } from "$lib/IR/schema";
import { type Complex, createComplex } from "./complex";

export interface QuantumGate {
    type: CanonicalUnitaryGate;
    matrix: Complex[][];
};

export const X_GATE: QuantumGate = {
    type: "x",
    matrix: [
        [createComplex(0, 0), createComplex(1, 0)], // [0, 1]
        [createComplex(1, 0), createComplex(0, 0)], // [1, 0]
    ],
};

export const Y_GATE: QuantumGate = {
    type: "y",
    matrix: [
        [createComplex(0, 0), createComplex(0, -1)], // [0, -i]
        [createComplex(0, 1), createComplex(0, 0)], // [i, 0]
    ],
};

export const Z_GATE: QuantumGate = {
    type: "z",
    matrix: [
        [createComplex(1, 0), createComplex(0, 0)], // [1, 0]
        [createComplex(0, 0), createComplex(-1, 0)], // [0, -1]
    ],
};

export const H_GATE: QuantumGate = {
    type: "h",
    matrix: [
        [createComplex(1 / Math.sqrt(2), 0), createComplex(1 / Math.sqrt(2), 0)], // [1/sqrt(2), 1/sqrt(2)]
        [createComplex(1 / Math.sqrt(2), 0), createComplex(-1 / Math.sqrt(2), 0)], // [1/sqrt(2), -1/sqrt(2)]
    ],
};

export const S_GATE: QuantumGate = {
    type: "s",
    matrix: [
        [createComplex(1, 0), createComplex(0, 0)], // [1, 0]
        [createComplex(0, 0), createComplex(0, 1)], // [0, i]
    ],
};

export const T_GATE: QuantumGate = {
    type: "t",
    matrix: [
        [createComplex(1, 0), createComplex(0, 0)], // [1, 0]
        [createComplex(0, 0), createComplex(Math.cos(Math.PI / 4), Math.sin(Math.PI / 4))], // [0, e^(i pi/4)]
    ],
};

export const GATE_MAP: Record<CanonicalUnitaryGate, QuantumGate> = {
    "x": X_GATE,
    "y": Y_GATE,
    "z": Z_GATE,
    "h": H_GATE,
    "s": S_GATE,
    "t": T_GATE,
}
