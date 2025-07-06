import { createComplex, type Complex } from "./complex";
import { type QuantumState } from "./vector";
import { add, multiply } from "./complex";

export type QuantumMatrix = Complex[][];

export function createMatrix(elements: Complex[][]): QuantumMatrix {
    return elements;
}

// Applies a quantum matrix (operator) to a quantum state, transforming it
// Parameters:
// - matrix: A 2D array of Complex numbers representing a quantum operator
// - state: A QuantumState (array of Complex numbers) to transform
// Returns: A new QuantumState resulting from the matrix-state multiplication
// Throws: Error if matrix dimensions don't match the state dimension
export function applyMatrix(matrix: Complex[][], state: QuantumState): QuantumState {
    const dim = state.length; // Get the dimension of the quantum state
    // Check if matrix is square and matches state dimension
    if (matrix.length !== dim || matrix.some(row => row.length !== dim)) {
        throw new Error("Matrix and state dimensions must match");
    }

    // Initialize result state with zeros (Complex numbers with re=0, im=0)
    const result: QuantumState = Array(dim).fill(null).map(() => ({ re: 0, im: 0 }));

    // Perform matrix-vector multiplication: result[i] = sum(matrix[i][j] * state[j])
    for (let i = 0; i < dim; i++) {
        for (let j = 0; j < dim; j++) {
            // Multiply matrix element with state element and add to result
            result[i] = add(result[i], multiply(matrix[i][j], state[j]));
        }
    }

    return result; // Return the transformed quantum state
}

// Computes the tensor product of two quantum states, combining them into a larger state
// Parameters:
// - state1: First QuantumState (array of Complex numbers)
// - state2: Second QuantumState (array of Complex numbers)
// Returns: A new QuantumState representing the tensor product
export function tensorProduct(state1: QuantumState, state2: QuantumState): QuantumState {
    const result: QuantumState = []; // Initialize empty result array

    // For each amplitude in state1 and state2, compute their product
    for (const amp1 of state1) {
        for (const amp2 of state2) {
            // Multiply amplitudes and add to result state
            result.push(multiply(amp1, amp2));
        }
    }

    return result; // Return the tensor product state
}

/**
 * Extends a single-qubit gate matrix to a multi-qubit gate matrix.
 * This function takes a single-qubit gate matrix and extends it to act on a specified qubit
 */
export function extendGateMatrix(singleGateMatrix: Complex[][], qubit: number, numQubits: number): Complex[][] {
    const dim = 1 << numQubits;
    let result: Complex[][] = Array(dim).fill(null).map(() => Array(dim).fill(createComplex(0, 0)));

    for (let i = 0; i < dim; i++) {
        result[i][i] = createComplex(1, 0);
    }

    for (let i = 0; i < dim; i++) {
        for (let j = 0; j < dim; j++) {
            const iQubitBit = (i >> (numQubits - 1 - qubit)) & 1;
            const jQubitBit = (j >> (numQubits - 1 - qubit)) & 1;
            const otherBitsMatch = (i ^ (iQubitBit << (numQubits - 1 - qubit))) === (j ^ (jQubitBit << (numQubits - 1 - qubit)));
            if (otherBitsMatch) {
                result[i][j] = singleGateMatrix[iQubitBit][jQubitBit];
            }
        }
    }
    return result;
};

export function computeControlledUMatrix(controlQubit: number, targetQubit: number, numQubits: number, U: Complex[][]): Complex[][] {
    const dim = 1 << numQubits;
    const zero = createComplex(0, 0);
    const one = createComplex(1, 0);

    const matrix: Complex[][] = Array(dim).fill(null).map(() => Array(dim).fill(zero));
    const bitPos = numQubits - 1 - targetQubit

    const bitMask = 1 << bitPos

    for (let src = 0; src < dim; src++) {
        const ctrlBit = (src >> (numQubits -  1 - controlQubit)) & 1;

        if (ctrlBit === 0) {
            matrix[src][src] = one; // Identity for control bit 0
            continue;
        }

        const beforeBit = (src >> bitPos) & 1;

        for (let rowBit = 0; rowBit < 2; rowBit++) {
            const amp = U[rowBit][beforeBit];

            if (amp.re === 0 && amp.im === 0) continue;

            const dest = (rowBit === beforeBit) ? src : (src ^ bitMask);

            matrix[dest][src] = amp;
        }
    }
    return matrix;
}

