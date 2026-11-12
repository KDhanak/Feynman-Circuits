import type { StepOperation, UnitaryOperation } from '../IR/schema';
import type { BitOrder } from '../stores/settingsStore';
import { type Complex, isNearZero } from '../quantum/complex';
import { GATE_REGISTRY } from '../quantum/gates';
import { formatRadiansAsPi } from '../utils/piMath';

// ─────────────────────────────────────────────────────────────
// Text for the step-by-step view. The simulator records each column
// (see SimulationStep). These helpers turn that record into the
// equation, the kets and the matrices shown on screen.
//
// Bit order: inside, q0 is always the smallest bit. The bit-order setting
// only changes the order things are WRITTEN in. It is used the same way
// here as in the results panel, so q0 sits in the same place in the
// ⊗ line, in the ket labels and in the matrix rows.
// ─────────────────────────────────────────────────────────────

// The qubits from left to right, as they are written on screen.
export function displayQubitOrder(numQubits: number, bitOrder: BitOrder): number[] {
	const ascending = Array.from({ length: numQubits }, (_, i) => i);
	return bitOrder === 'q0-left' ? ascending : ascending.reverse();
}

// The label of a basis state, e.g. index 6 on 3 qubits is "110" (q0 rightmost).
export function basisLabel(index: number, numQubits: number, bitOrder: BitOrder): string {
	const bits = index.toString(2).padStart(numQubits, '0');
	return bitOrder === 'q0-left' ? Array.from(bits).reverse().join('') : bits;
}

// The basis states in the order they are listed on screen: sorted by their
// written label, so with q0 on the left the rows still read 000, 001, 010, …
export function displayIndexOrder(numQubits: number, bitOrder: BitOrder): number[] {
	return Array.from({ length: 1 << numQubits }, (_, i) => i).sort((a, b) =>
		basisLabel(a, numQubits, bitOrder).localeCompare(basisLabel(b, numQubits, bitOrder))
	);
}

// A number with up to 3 decimals and no trailing zeros: 0.70710 → "0.707", 1 → "1".
function formatNumber(x: number): string {
	const text = Math.abs(x)
		.toFixed(3)
		.replace(/\.?0+$/, '');
	return (x < 0 ? '−' : '') + text;
}

// A complex number as short text: "0", "0.707", "−0.5i", "0.5+0.5i".
export function formatAmplitude({ re, im }: Complex): string {
	const hasRe = !isNearZero(re);
	const hasIm = !isNearZero(im);
	if (!hasRe && !hasIm) return '0';
	const imText = (v: number) => (formatNumber(v) === '1' ? '' : formatNumber(v)) + 'i';
	if (!hasIm) return formatNumber(re);
	if (!hasRe) return im < 0 ? '−' + imText(-im) : imText(im);
	return `${formatNumber(re)}${im < 0 ? '−' : '+'}${imText(Math.abs(im))}`;
}

// The gate's name with its angle, e.g. "H", "RX(π/2)".
export function gateName(op: UnitaryOperation): string {
	const spec = GATE_REGISTRY[op.gate];
	if (spec.numParams === 0) return spec.label;
	return `${spec.label}(${formatRadiansAsPi(op.params[0] ?? 0)})`;
}

// True when the operation touches more than one qubit, so it cannot be one
// factor of the ⊗ product.
function isMultiQubit(op: UnitaryOperation): boolean {
	return op.gate === 'swap' || op.controls.length > 0 || op.antiControls.length > 0;
}

// A multi-qubit operation as one factor of the operator line, e.g.
// "CX(q0 → q1)". An anti-control is marked with ¬ (it fires on |0⟩).
function multiQubitFactor(op: UnitaryOperation): string {
	if (op.gate === 'swap') return `SWAP(q${op.targets[0]}, q${op.targets[1]})`;
	const conditions = [...op.controls.map((q) => `q${q}`), ...op.antiControls.map((q) => `¬q${q}`)];
	const prefix = 'C'.repeat(conditions.length);
	return `${prefix}${gateName(op)}(${conditions.join(', ')} → q${op.targets[0]})`;
}

// One sentence saying what the operation does, e.g. "X on q1, only when q0 = 1".
export function describeOperation(op: UnitaryOperation): string {
	if (op.gate === 'swap') return `SWAP exchanges q${op.targets[0]} and q${op.targets[1]}`;
	const text = `${gateName(op)} on q${op.targets[0]}`;
	const conditions = [
		...op.controls.map((q) => `q${q} = 1`),
		...op.antiControls.map((q) => `q${q} = 0`)
	];
	return conditions.length ? `${text}, only when ${conditions.join(' and ')}` : text;
}

/**
 * The whole column written as one operator, e.g. "(H ⊗ I ⊗ I) · CX(q0 → q1)".
 *
 * Gates in one column act on different qubits. So the single-qubit gates
 * join into one ⊗ product, with I (do nothing) on every other wire, and each
 * multi-qubit gate is one more factor next to it. The factors act on different
 * qubits, so the order they are multiplied in does not matter.
 */
export function operatorLine(ops: StepOperation[], numQubits: number, bitOrder: BitOrder): string {
	const applied = ops.filter((o) => !o.skipped).map((o) => o.op);
	const singles = new Map(
		applied.filter((op) => !isMultiQubit(op)).map((op) => [op.targets[0], gateName(op)])
	);
	const factors: string[] = [];
	if (singles.size > 0) {
		const tensor = displayQubitOrder(numQubits, bitOrder)
			.map((q) => singles.get(q) ?? 'I')
			.join(' ⊗ ');
		factors.push(tensor);
	}
	factors.push(...applied.filter(isMultiQubit).map(multiQubitFactor));

	if (factors.length === 0) return 'I';
	if (factors.length === 1) return factors[0];
	return factors.map((f) => (f.includes('⊗') ? `(${f})` : f)).join(' · ');
}

// The biggest factor whose matrix is written out: 3 qubits is 8×8.
export const MAX_FACTOR_QUBITS = 3;

/** One factor of the column's operator, small enough to open on its own. */
export interface OperatorFactor {
	key: string;
	label: string; // e.g. "H", "I", "CX(q0 → q1)"
	qubits: number[]; // the qubits it acts on, in screen order
	// Its matrix on those qubits only, with the smallest of them as the lowest
	// bit, like the simulator. Null when it acts on more than MAX_FACTOR_QUBITS.
	matrix: Complex[][] | null;
	note?: string; // e.g. "θ = π/2"
}

const ONE = { re: 1, im: 0 };
const ZERO = { re: 0, im: 0 };
const IDENTITY_2: Complex[][] = [
	[ONE, ZERO],
	[ZERO, ONE]
];

// The matrix of a multi-qubit operation on just the qubits it touches. Column
// c is where basis state c goes, so each column is filled in by running the
// operation on that one basis state.
function localMatrix(op: UnitaryOperation, qubits: number[]): Complex[][] | null {
	if (qubits.length > MAX_FACTOR_QUBITS) return null;
	const dim = 1 << qubits.length;
	const bit = (q: number) => 1 << qubits.indexOf(q);
	const m: Complex[][] = Array.from({ length: dim }, () => Array(dim).fill(ZERO));
	for (let c = 0; c < dim; c++) {
		if (op.gate === 'swap') {
			const [a, b] = op.targets.map(bit);
			const swapped = !(c & a) === !(c & b) ? c : c ^ a ^ b;
			m[swapped][c] = ONE;
			continue;
		}
		const fires =
			op.controls.every((q) => c & bit(q)) && op.antiControls.every((q) => !(c & bit(q)));
		if (!fires) {
			m[c][c] = ONE;
			continue;
		}
		const t = bit(op.targets[0]);
		const u = GATE_REGISTRY[op.gate].matrix!(op.params);
		const inBit = c & t ? 1 : 0;
		for (const outBit of [0, 1]) m[(c & ~t) | (outBit ? t : 0)][c] = u[outBit][inBit];
	}
	return m;
}

/**
 * The column's operator as separate factors, so each one can be opened and
 * read on its own, however many qubits the circuit has. `tensor` is the ⊗
 * product of single-qubit gates (I on every idle wire), in screen order.
 * `products` are the multi-qubit operations, each one more factor beside it.
 * Same split as operatorLine.
 */
export function operatorFactors(
	ops: StepOperation[],
	numQubits: number,
	bitOrder: BitOrder
): { tensor: OperatorFactor[]; products: OperatorFactor[] } {
	const applied = ops.filter((o) => !o.skipped).map((o) => o.op);
	const singles = new Map(
		applied.filter((op) => !isMultiQubit(op)).map((op) => [op.targets[0], op])
	);
	const tensor: OperatorFactor[] =
		singles.size === 0
			? []
			: displayQubitOrder(numQubits, bitOrder).map((q) => {
					const op = singles.get(q);
					const spec = op ? GATE_REGISTRY[op.gate] : null;
					return {
						key: `q${q}`,
						label: op ? gateName(op) : 'I',
						qubits: [q],
						matrix: op ? spec!.matrix!(op.params) : IDENTITY_2,
						note: op ? undefined : 'nothing happens on this wire'
					};
				});
	const products = applied.filter(isMultiQubit).map((op) => {
		const qubits = [...new Set([...op.targets, ...op.controls, ...op.antiControls])].sort(
			(a, b) => a - b
		);
		return {
			key: op.id,
			label: multiQubitFactor(op),
			qubits: displayQubitOrder(qubits.length, bitOrder).map((j) => qubits[j]),
			matrix: localMatrix(op, qubits)
		};
	});
	return { tensor, products };
}

export interface KetTerm {
	sign: '+' | '−';
	coefficient: string;
	label: string;
	changed: boolean; // the amplitude is different from the same term in `compareWith`
}

// The non-zero terms of a state, in screen order. A real (or purely imaginary)
// negative amplitude is shown as a minus between the terms instead of "+ −0.5".
export function ketTerms(
	state: Complex[],
	numQubits: number,
	bitOrder: BitOrder,
	compareWith?: Complex[]
): KetTerm[] {
	const terms: KetTerm[] = [];
	for (const i of displayIndexOrder(numQubits, bitOrder)) {
		const amp = state[i];
		const text = formatAmplitude(amp);
		if (text === '0') continue;
		const other = compareWith?.[i];
		const changed =
			!!other && (Math.abs(other.re - amp.re) > 1e-9 || Math.abs(other.im - amp.im) > 1e-9);
		// A full complex number stays in brackets after a "+". Otherwise the
		// amplitude is one real or imaginary number, and its minus moves out.
		const isComplex = !isNearZero(amp.re) && !isNearZero(amp.im);
		const negative = !isComplex && (isNearZero(amp.re) ? amp.im : amp.re) < 0;
		terms.push({
			sign: negative ? '−' : '+',
			coefficient: isComplex
				? `(${text})`
				: negative
					? formatAmplitude({ re: -amp.re, im: -amp.im })
					: text,
			label: basisLabel(i, numQubits, bitOrder),
			changed
		});
	}
	return terms;
}

// A full matrix as text, with rows and columns in screen order.
export function matrixText(matrix: Complex[][], order: number[]): string[][] {
	return order.map((i) => order.map((j) => formatAmplitude(matrix[i][j])));
}

// A state as a one-column matrix, in screen order.
export function vectorText(state: Complex[], order: number[]): string[][] {
	return order.map((i) => [formatAmplitude(state[i])]);
}

// Index digits for ψ₀, ψ₁, …
export function subscript(n: number): string {
	return String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]);
}
