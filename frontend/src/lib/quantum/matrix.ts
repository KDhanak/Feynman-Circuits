import {type Complex} from "./complex";

export type QuantumMatrix = Complex[][];

export function createMatrix(elements: Complex[][]): QuantumMatrix {
    return elements;
}
