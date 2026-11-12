import type { Complex } from './complex';

/**
 * The Q-sphere: a picture of the whole state of several qubits, the way IBM
 * Quantum Composer draws it. A Bloch sphere shows one qubit, and averaging
 * the qubits' Bloch vectors throws the entanglement away (a Bell pair
 * averages to the centre). The Q-sphere shows every basis state instead.
 *
 * - Each basis state with a non-zero amplitude is one dot.
 * - Where it sits: |00…0⟩ at the north pole, |11…1⟩ at the south pole, and
 *   the rest on rings in between, by how many 1s they have. So states one bit
 *   flip apart sit close together.
 * - Dot size is the probability, dot colour is the phase.
 */

// The Q-sphere is drawn for up to this many qubits. 6 qubits is 64 states,
// which still reads as separate dots. Above it the board says why it is off.
export const QSPHERE_MAX_QUBITS = 6;

// States less likely than this are left off. They would be dots too small to see.
export const QSPHERE_MIN_PROBABILITY = 1e-6;

export interface QSpherePoint {
	index: number; // the basis state, as a number (q0 is the smallest bit)
	x: number;
	y: number;
	z: number;
	probability: number;
	/** Phase in radians, from −π to π, measured from the most likely state's phase. */
	phase: number;
}

function binomial(n: number, k: number): number {
	let result = 1;
	for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i;
	return Math.round(result);
}

function weightOf(index: number): number {
	let w = 0;
	for (let i = index; i; i >>= 1) w += i & 1;
	return w;
}

/**
 * Where each basis state sits on the sphere, and its probability and phase.
 *
 * Position, as Qiskit's plot_state_qsphere does it: a state with w ones out of
 * n qubits sits at height z = 1 − 2w/n. The states with the same w share that
 * ring, spread evenly in order of their number, and each ring is turned a
 * little (by w/n of a full turn) so the rings' dots don't all line up.
 *
 * Phase: multiplying the whole state by one phase changes nothing you can
 * measure, so the picture shouldn't change either. We turn every phase by the
 * same amount, so the most likely state has phase 0. Then only the phases
 * between the states, which do matter, show as colour.
 */
export function qspherePoints(
	state: Complex[],
	minProbability = QSPHERE_MIN_PROBABILITY
): QSpherePoint[] {
	const n = Math.round(Math.log2(state.length));
	if (n < 1) return [];

	// The most likely state sets the phase. On a tie, the first one wins, so the
	// picture doesn't jump between equally likely states.
	let ref = 0;
	let refProb = -1;
	state.forEach(({ re, im }, i) => {
		const p = re * re + im * im;
		if (p > refProb + 1e-12) {
			ref = i;
			refProb = p;
		}
	});
	const refAngle = Math.atan2(state[ref].im, state[ref].re);

	// How far along its ring each state is: its place among the states with the
	// same number of 1s, counted in order.
	const seen = new Array<number>(n + 1).fill(0);
	const points: QSpherePoint[] = [];
	for (let i = 0; i < state.length; i++) {
		const w = weightOf(i);
		const place = seen[w]++;
		const { re, im } = state[i];
		const probability = re * re + im * im;
		if (probability < minProbability) continue;

		const z = 1 - (2 * w) / n;
		const ringSize = binomial(n, w);
		const angle = (w / n) * 2 * Math.PI + (place * 2 * Math.PI) / ringSize;
		const r = Math.sqrt(Math.max(0, 1 - z * z));
		let phase = Math.atan2(im, re) - refAngle;
		// Back into −π…π. Without this, 3π/2 and −π/2 would get different colours.
		phase = Math.atan2(Math.sin(phase), Math.cos(phase));
		// Snap tiny rounding errors to exactly 0 and π, so a real state reads as
		// 0° and 180°, not 0.0000001° and −179.99999°.
		if (Math.abs(phase) < 1e-9) phase = 0;
		if (Math.abs(Math.abs(phase) - Math.PI) < 1e-9) phase = Math.PI;

		points.push({
			index: i,
			x: r * Math.cos(angle),
			y: r * Math.sin(angle),
			z,
			probability,
			phase
		});
	}
	return points;
}

/**
 * The colour of a phase, round a colour wheel: 0 is the brand purple, and
 * the hue turns with the phase, so π is the colour opposite it.
 */
export function phaseColor(phase: number): string {
	const degrees = (phase * 180) / Math.PI;
	const hue = (((265 + degrees) % 360) + 360) % 360;
	return `hsl(${hue.toFixed(0)} 75% 55%)`;
}
