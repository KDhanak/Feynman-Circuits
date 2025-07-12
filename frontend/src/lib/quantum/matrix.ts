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

/**
 * Build the full unitary matrix for a controlled-U gate with any number of control wires and one or more target wires.
 * Controls ... indices of *qubits* that must be in state |1⟩.
 * targets ... indices of *qubits* on which the 2x2 matric U acts.
 * U ... a 2x2 single-qubit operator (e.g. X, Y, H, T, etc.)
 * numQubits ... total number of qubits in the circuit
 * 
 * Returned matrix has dimensions 2^numQubits x 2^numQubits.
 */

export function buildMultiControlledUMatrix(controls: number[], targets: number[], U: Complex[][], numQubits: number): Complex[][] {

    /* ---------- bit masks for fast tests ----------------- */
    const controlMask = controls.reduce((m, q) => m | (1 << (numQubits - 1 - q)), 0);
    const targetMask = targets.reduce((m, q) => m | (1 << (numQubits - 1 - q)), 0);

    /* ---------- allocate identity ------------------------ */
    const dim = 1 << numQubits;
    const M: Complex[][] = Array.from({ length: dim }, () => Array.from({ length: dim }, () => createComplex(0, 0)));

    /* ---------- fill matrix row-by-row -------------------- */
    for (let src = 0; src < dim; src++) {
        /* controls must all be 1 */
        const controlsSatisfied = (src & controlMask) === controlMask;

        if (!controlsSatisfied) {
            /* acts as identity on this basis state */
            M[src][src] = createComplex(1, 0);
            continue;
        }

        /* Build the 1- or n-target mapping.
       We iterate over every possible combination of target-bit outcomes,
       apply U on *each* target wire separately.*/

        let dest = src;
        let amp = createComplex(1, 0);

        /* Apply U for every target qubit (one at a time) */
        for (const tq of targets) {
            const bitPos = numQubits - 1 - tq;
            const bitIsOne = (dest >> bitPos) & 1;

            /* amplitude multiplier from U[row][col] */
            const uAmp = U[bitIsOne][bitIsOne ^ 1];

            /*flip the target bit if needed X^something */
            if (uAmp.re !== 0 || uAmp.im !== 0) {
                dest ^= (1 << bitPos);
            }

            amp = multiply(amp, uAmp);
        }

        if (amp.re !== 0 || amp.im !== 0) {
            M[dest][src] = amp;
        }
    }
    return M;

}
