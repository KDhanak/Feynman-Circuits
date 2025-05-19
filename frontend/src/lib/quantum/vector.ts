import { type Complex, add, multiply} from "./complex";

export type QuantumState = Complex[];

export function createState(amplitudes: Complex[]): QuantumState {
    return amplitudes;
}

export function applyMatrix(matrix: Complex[][], state: QuantumState): QuantumState {
    const dim = state.length;
    if (matrix.length !== dim || matrix.some(row => row.length !== dim)) {
        throw new Error("Matrix and state dimensions must match");
    }

    const result: QuantumState = Array(dim).fill(null).map(() => ({re: 0, im: 0}));

    for (let i = 0; i < dim; i++) {
        for (let j = 0; j < dim; j++) {
            result[i] = add(result[i], multiply(matrix[i][j], state[j]));
        }
    }

    return result;
}

export function tensorProduct(state1: QuantumState, state2: QuantumState): QuantumState {
    const result: QuantumState = [];

    for (const amp1 of state1) {
        for (const amp2 of state2) {
            result.push(multiply(amp1, amp2));
        }
    }

    return result;
}
