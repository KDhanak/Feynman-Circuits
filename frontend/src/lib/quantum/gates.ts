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

export function createRXGate(theta: number): QuantumGate {
    const halfTheta = theta / 2;
    const cosHalf = Math.cos(halfTheta);
    const sinHalf = Math.sin(halfTheta);
    return {
        type: "rx",
        matrix: [
            [createComplex(cosHalf, 0), createComplex(0, -sinHalf)], // [cos(θ/2), -i*sin(θ/2)]
            [createComplex(0, -sinHalf), createComplex(cosHalf, 0)], // [-i*sin(θ/2), cos(θ/2)]
        ],
    };
}

export function createRYGate(theta: number): QuantumGate {
    const halfTheta = theta / 2;
    const cosHalf = Math.cos(halfTheta);
    const sinHalf = Math.sin(halfTheta);
    return {
        type: "ry",
        matrix: [
            [createComplex(cosHalf, 0), createComplex(-sinHalf, 0)], // [cos(θ/2), -sin(θ/2)]
            [createComplex(sinHalf, 0), createComplex(cosHalf, 0)],  // [sin(θ/2),  cos(θ/2)]
        ],
    };
}

export function createRZGate(theta: number): QuantumGate {
    const halfTheta = theta / 2;
    return {
        type: "rz",
        matrix: [
            [createComplex(Math.cos(-halfTheta), Math.sin(-halfTheta)), createComplex(0, 0)], // e^(-i*theta/2)
            [createComplex(0, 0), createComplex(Math.cos(halfTheta), Math.sin(halfTheta))], // e^(i*theta/2)
        ],
    };
}

export const RX_GATE: QuantumGate = createRXGate(0);
export const RY_GATE: QuantumGate = createRYGate(0);
export const RZ_GATE: QuantumGate = createRZGate(0);

export const GATE_MAP: Record<CanonicalUnitaryGate, QuantumGate> = {
    "x": X_GATE,
    "y": Y_GATE,
    "z": Z_GATE,
    "h": H_GATE,
    "s": S_GATE,
    "t": T_GATE,
    "rx": RX_GATE,
    "ry": RY_GATE,
    "rz": RZ_GATE,
}
