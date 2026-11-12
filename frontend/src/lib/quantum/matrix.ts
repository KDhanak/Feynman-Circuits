import { createComplex, type Complex } from './complex';
import { type QuantumState } from './vector';
import { add, multiply, isZero } from './complex';

export type QuantumMatrix = Complex[][];

export function createMatrix(elements: Complex[][]): QuantumMatrix {
	return elements;
}

// Applies a quantum matrix (operator) to a quantum state and returns the new state
// Parameters:
// - matrix: A 2D array of Complex numbers that stands for a quantum operator
// - state: The QuantumState (array of Complex numbers) to change
// Returns: A new QuantumState, the result of multiplying the matrix by the state
// Throws: An error if the matrix size does not match the state size
export function applyMatrix(matrix: Complex[][], state: QuantumState): QuantumState {
	const dim = state.length; // The size of the quantum state
	// Check that the matrix is square and the same size as the state
	if (matrix.length !== dim || matrix.some((row) => row.length !== dim)) {
		throw new Error('Matrix and state dimensions must match');
	}

	// Start the result state with all zeros (Complex numbers with re=0, im=0)
	const result: QuantumState = Array(dim)
		.fill(null)
		.map(() => ({ re: 0, im: 0 }));

	// Multiply the matrix by the vector: result[i] = sum(matrix[i][j] * state[j])
	for (let i = 0; i < dim; i++) {
		for (let j = 0; j < dim; j++) {
			// Multiply matrix element with state element and add to result
			result[i] = add(result[i], multiply(matrix[i][j], state[j]));
		}
	}

	return result; // Return the new quantum state
}

/**
 * Applies a 2×2 gate U to one target qubit, straight on the state, with any
 * controls (must be 1) and anti-controls (must be 0). It gives the same result
 * as building the full 2ⁿ×2ⁿ matrix and multiplying, but never builds it.
 *
 * Why: the full matrix has 4ⁿ entries, so each extra qubit made every gate
 * about 4× slower and 10 qubits already took seconds. Here each gate only
 * visits the 2ⁿ amplitudes once, in pairs: every pair differs only in the
 * target bit, and U mixes the two.
 */
export function applyGate(
	state: QuantumState,
	U: Complex[][],
	target: number,
	controls: number[] = [],
	antiControls: number[] = []
): QuantumState {
	const result = state.slice();
	const tMask = 1 << target;
	let cMask = 0;
	for (const c of controls) cMask |= 1 << c;
	let aMask = 0;
	for (const a of antiControls) aMask |= 1 << a;
	const [[u00, u01], [u10, u11]] = U;

	for (let i0 = 0; i0 < state.length; i0++) {
		// Visit each pair once, from its member with the target bit at 0.
		if (i0 & tMask) continue;
		if ((i0 & cMask) !== cMask || (i0 & aMask) !== 0) continue;
		const i1 = i0 | tMask;
		const a = state[i0];
		const b = state[i1];
		result[i0] = {
			re: u00.re * a.re - u00.im * a.im + u01.re * b.re - u01.im * b.im,
			im: u00.re * a.im + u00.im * a.re + u01.re * b.im + u01.im * b.re
		};
		result[i1] = {
			re: u10.re * a.re - u10.im * a.im + u11.re * b.re - u11.im * b.im,
			im: u10.re * a.im + u10.im * a.re + u11.re * b.im + u11.im * b.re
		};
	}
	return result;
}

// Works out the tensor product of two quantum states, joining them into one bigger state
// Parameters:
// - state1: First QuantumState (array of Complex numbers)
// - state2: Second QuantumState (array of Complex numbers)
// Returns: A new QuantumState that is the tensor product
export function tensorProduct(state1: QuantumState, state2: QuantumState): QuantumState {
	const result: QuantumState = []; // Start with an empty result array

	// Multiply every amplitude in state1 by every amplitude in state2
	for (const amp1 of state1) {
		for (const amp2 of state2) {
			// Multiply amplitudes and add to result state
			result.push(multiply(amp1, amp2));
		}
	}

	return result; // Return the tensor product state
}

/**
 * Turns a single-qubit gate matrix into a matrix for the whole multi-qubit system.
 * The gate acts on the chosen qubit and leaves every other qubit unchanged.
 * Bit order: qubit q is bit number q in the state, so q0 is the rightmost (smallest) bit.
 */
export function extendGateMatrix(
	singleGateMatrix: Complex[][],
	qubit: number,
	numQubits: number
): Complex[][] {
	const dim = 1 << numQubits;
	const result: Complex[][] = Array(dim)
		.fill(null)
		.map(() => Array(dim).fill(createComplex(0, 0)));

	for (let i = 0; i < dim; i++) {
		result[i][i] = createComplex(1, 0);
	}

	for (let i = 0; i < dim; i++) {
		for (let j = 0; j < dim; j++) {
			const iQubitBit = (i >> qubit) & 1;
			const jQubitBit = (j >> qubit) & 1;
			const otherBitsMatch = (i ^ (iQubitBit << qubit)) === (j ^ (jQubitBit << qubit));
			if (otherBitsMatch) {
				result[i][j] = singleGateMatrix[iQubitBit][jQubitBit];
			}
		}
	}
	return result;
}

export function computeControlledUMatrix(
	controlQubit: number,
	targetQubit: number,
	numQubits: number,
	U: Complex[][]
): Complex[][] {
	const dim = 1 << numQubits;
	const zero = createComplex(0, 0);
	const one = createComplex(1, 0);

	const matrix: Complex[][] = Array(dim)
		.fill(null)
		.map(() => Array(dim).fill(zero));
	const bitPos = targetQubit;
	const bitMask = 1 << bitPos;

	for (let src = 0; src < dim; src++) {
		const ctrlBit = (src >> controlQubit) & 1;

		if (ctrlBit === 0) {
			matrix[src][src] = one; // Leave it unchanged when the control bit is 0
			continue;
		}

		const beforeBit = (src >> bitPos) & 1;

		for (let rowBit = 0; rowBit < 2; rowBit++) {
			const amp = U[rowBit][beforeBit];

			if (isZero(amp)) continue;

			const dest = rowBit === beforeBit ? src : src ^ bitMask;

			matrix[dest][src] = amp;
		}
	}
	return matrix;
}

/**
 * Builds the full gate matrix for n control qubits and 1 target qubit
 * @param controlQubits - Array of control qubit indices
 * @param targetQubit - Target qubit index
 * @param numQubits - Total qubits in the system
 * @param U - The 2×2 unitary gate to apply when all controls are 1
 * @returns Full (2^numQubits × 2^numQubits) controlled matrix
 */
export function computeMultiControlledUMatrix(
	controlQubits: number[],
	targetQubit: number,
	numQubits: number,
	U: Complex[][]
): Complex[][] {
	const dim = 1 << numQubits;
	const matrix: Complex[][] = Array(dim)
		.fill(null)
		.map(() => Array(dim).fill(createComplex(0, 0)));
	const one = createComplex(1, 0);

	for (let src = 0; src < dim; src++) {
		// Check if all control qubits are on (set to 1)
		const allControlsActive = controlQubits.every((ctrl) => (src >> ctrl) & 1);

		if (!allControlsActive) {
			matrix[src][src] = one; // Leave it unchanged if any control is off
			continue;
		}

		// All controls are on, so apply U to the target qubit
		const targetBit = (src >> targetQubit) & 1;
		const targetMask = 1 << targetQubit;

		for (let rowBit = 0; rowBit < 2; rowBit++) {
			const amp = U[rowBit][targetBit];
			if (isZero(amp)) continue;

			const dest = rowBit === targetBit ? src : src ^ targetMask;
			matrix[dest][src] = amp;
		}
	}
	return matrix;
}

/**
 * Builds the full gate matrix for n control qubits, m anti-control qubits, and 1 target qubit
 * The gate is applied only when: all controls are 1 AND all anti-controls are 0
 * @param controlQubits - Array of control qubit indices (gate applies when these are |1⟩)
 * @param antiControlQubits - Array of anti-control qubit indices (gate applies when these are |0⟩)
 * @param targetQubit - Target qubit index
 * @param numQubits - Total qubits in the system
 * @param U - The 2×2 unitary gate to apply when the conditions above are met
 * @returns Full (2^numQubits × 2^numQubits) controlled matrix
 */
export function computeMultiControlledUMatrixWithAntiControls(
	controlQubits: number[],
	antiControlQubits: number[],
	targetQubit: number,
	numQubits: number,
	U: Complex[][]
): Complex[][] {
	const dim = 1 << numQubits;
	const matrix: Complex[][] = Array(dim)
		.fill(null)
		.map(() => Array(dim).fill(createComplex(0, 0)));
	const one = createComplex(1, 0);

	for (let src = 0; src < dim; src++) {
		// Check if all control qubits are 1
		const allControlsActive = controlQubits.every((ctrl) => (src >> ctrl) & 1);
		// Check if all anti-control qubits are 0
		const allAntiControlsInactive = antiControlQubits.every((antiCtrl) => !((src >> antiCtrl) & 1));

		if (!allControlsActive || !allAntiControlsInactive) {
			matrix[src][src] = one; // Leave it unchanged when the conditions are not met
			continue;
		}

		// Controls and anti-controls are all as needed, so apply U to the target qubit
		const targetBit = (src >> targetQubit) & 1;
		const targetMask = 1 << targetQubit;

		for (let rowBit = 0; rowBit < 2; rowBit++) {
			const amp = U[rowBit][targetBit];
			if (isZero(amp)) continue;

			const dest = rowBit === targetBit ? src : src ^ targetMask;
			matrix[dest][src] = amp;
		}
	}
	return matrix;
}

// The identity matrix of size dim × dim (leaves every state unchanged).
export function identityMatrix(dim: number): Complex[][] {
	return Array.from({ length: dim }, (_, i) =>
		Array.from({ length: dim }, (_, j) => createComplex(i === j ? 1 : 0, 0))
	);
}

// Matrix product a · b. Used to join the gates of one column into a single matrix.
export function multiplyMatrices(a: Complex[][], b: Complex[][]): Complex[][] {
	const dim = a.length;
	return Array.from({ length: dim }, (_, i) =>
		Array.from({ length: dim }, (_, j) => {
			let sum = createComplex(0, 0);
			for (let k = 0; k < dim; k++) sum = add(sum, multiply(a[i][k], b[k][j]));
			return sum;
		})
	);
}

// The SWAP of qubits q1 and q2 as a full matrix. The simulator swaps amplitudes
// directly instead, so this is only used to show the column as a matrix.
// It is a permutation matrix: it moves the amplitude of each basis state to the
// basis state with the two bits exchanged.
export function swapMatrix(q1: number, q2: number, numQubits: number): Complex[][] {
	const dim = 1 << numQubits;
	const result = Array.from({ length: dim }, () =>
		Array.from({ length: dim }, () => createComplex(0, 0))
	);
	for (let i = 0; i < dim; i++) {
		const b1 = (i >> q1) & 1;
		const b2 = (i >> q2) & 1;
		const j = b1 === b2 ? i : i ^ (1 << q1) ^ (1 << q2);
		result[j][i] = createComplex(1, 0);
	}
	return result;
}
