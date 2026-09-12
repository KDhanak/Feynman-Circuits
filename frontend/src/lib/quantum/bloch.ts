import type { Complex } from './complex';

export interface BlochVector {
	qubit: number;
	x: number;
	y: number;
	z: number;
	magnitude: number; // <= 1. Less than 1 means mixed (for example, an entangled qubit)
}

function clamp(n: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, n));
}

function bitPosition(numQubits: number, qubit: number): number {
	// We number the bits the same way as Qiskit/OpenQASM: qubit q is bit number q
	// in the state, so q0 is the rightmost bit when the bitstring is written out.
	return qubit;
}

/**
 * Bloch vector of one qubit. We get its reduced density matrix ρ_q by tracing
 * out (removing) every other qubit, then: x = 2·Re(ρ_10) = ⟨X⟩,
 * y = 2·Im(ρ_10) = ⟨Y⟩, z = ρ_00 − ρ_11 = ⟨Z⟩. The partial trace adds up the
 * pairs of indices (i, i|mask) that differ only in this qubit's bit.
 * |r| < 1 means the qubit is mixed, which means it is entangled with the other qubits.
 */
export function computeBlochVectorForQubit(
	state: Complex[],
	numQubits: number,
	qubit: number
): BlochVector {
	const pos = bitPosition(numQubits, qubit);
	const mask = 1 << pos;

	let p0 = 0;
	let p1 = 0;
	let crossRe = 0;
	let crossIm = 0;

	for (let i = 0; i < state.length; i++) {
		if ((i & mask) !== 0) continue; // only handle pairs where target bit is 0

		const j = i | mask;
		const a0 = state[i];
		const a1 = state[j];

		p0 += a0.re * a0.re + a0.im * a0.im;
		p1 += a1.re * a1.re + a1.im * a1.im;

		// conj(a0) * a1
		crossRe += a0.re * a1.re + a0.im * a1.im;
		crossIm += a0.re * a1.im - a0.im * a1.re;
	}

	const x = 2 * crossRe;
	const y = 2 * crossIm;
	const z = p0 - p1;
	const magnitude = clamp(Math.sqrt(x * x + y * y + z * z), 0, 1);

	return { qubit, x, y, z, magnitude };
}

export function computeBlochVectorsFromState(state: Complex[], numQubits: number): BlochVector[] {
	return Array.from({ length: numQubits }, (_, q) =>
		computeBlochVectorForQubit(state, numQubits, q)
	);
}

/**
 * The average of all the qubits' Bloch vectors (x with x, y with y, z with z).
 * This is the same as the Bloch vector of the average single-qubit state (1/n)·Σ ρ_q.
 *
 * For a 1-qubit circuit this is exactly that qubit's state. For more qubits it
 * is only a summary, not the full n-qubit state, because that state doesn't fit
 * on one sphere. Good to know: |01⟩ averages to the centre even though it is
 * pure and fully known, and a Bell pair also sits at the centre because both of
 * its reduced states are maximally mixed. So the length of the arrow tells you
 * about the average, not about how pure the circuit is.
 */
export function computeOverallBlochVector(vectors: BlochVector[]): BlochVector {
	if (!vectors.length) {
		return { qubit: -1, x: 0, y: 0, z: 1, magnitude: 1 };
	}

	const n = vectors.length;
	const x = vectors.reduce((sum, v) => sum + v.x, 0) / n;
	const y = vectors.reduce((sum, v) => sum + v.y, 0) / n;
	const z = vectors.reduce((sum, v) => sum + v.z, 0) / n;
	const magnitude = Math.min(1, Math.sqrt(x * x + y * y + z * z));

	return { qubit: -1, x, y, z, magnitude };
}
