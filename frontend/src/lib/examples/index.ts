import type { CanonicalUnitaryGate, CircuitIR, UnitaryOperation } from '../IR/schema';

/**
 * Ready-made example circuits. Each one is a whole circuit, not a piece added
 * to the board, because most of them only work from a fresh |0…0⟩ start.
 *
 * Qubit numbers are as the board shows them: q0 is the top wire. The simulator
 * writes basis states with q0 as the rightmost bit, so "011" means q0 = 1,
 * q1 = 1, q2 = 0. The `result` text below follows the same order.
 */
export type ExampleId = 'ghz3' | 'superdense' | 'deutsch-jozsa' | 'grover' | 'teleport' | 'qft3';

export interface Example {
	id: ExampleId;
	name: string;
	qubits: number;
	/** One line for the menu. */
	summary: string;
	/** A few sentences on what the circuit does and what to look for. */
	detail: string;
	build: () => UnitaryOperation[];
	/** Named parts of the circuit, drawn as zones on the board. Columns are 0-based. */
	zones?: { name: string; startColumn: number; endColumn: number }[];
}

type GateOptions = { controls?: number[]; param?: number };

function op(
	gate: CanonicalUnitaryGate,
	column: number,
	targets: number[],
	{ controls = [], param }: GateOptions = {}
): UnitaryOperation {
	return {
		id: crypto.randomUUID(),
		kind: 'unitary',
		gate,
		column,
		targets,
		controls,
		antiControls: [],
		params: param === undefined ? [] : [param]
	};
}

export const EXAMPLES: Example[] = [
	{
		id: 'ghz3',
		name: 'GHZ-3',
		qubits: 3,
		summary: 'Three qubits that always agree',
		detail:
			'A Bell pair stretched to three qubits: (|000⟩ + |111⟩)/√2. H puts q0 in superposition, then each CNOT passes the link one qubit further. Measuring gives 000 or 111, never a mix, and each qubit on its own is a 50/50 coin.',
		build: () => [
			op('h', 0, [0]),
			op('x', 1, [1], { controls: [0] }),
			op('x', 2, [2], { controls: [1] })
		]
	},
	{
		id: 'superdense',
		name: 'Superdense coding',
		qubits: 2,
		summary: 'Two bits sent with one qubit',
		detail:
			'Alice and Bob share a Bell pair (columns 1–2). Alice encodes two bits by acting only on her qubit, q0: X sends the first bit, Z the second. Here both are on, so the message is 11. Bob undoes the Bell pair (CNOT, then H) and reads 11 with certainty. Delete the X or the Z to send 01, 10 or 00.',
		build: () => [
			op('h', 0, [0]),
			op('x', 1, [1], { controls: [0] }),
			op('x', 2, [0]),
			op('z', 3, [0]),
			op('x', 4, [1], { controls: [0] }),
			op('h', 5, [0])
		]
	},
	{
		id: 'deutsch-jozsa',
		name: 'Deutsch–Jozsa',
		qubits: 2,
		summary: 'Constant or balanced, in one run',
		detail:
			'Is a hidden function f(x) the same for every input (constant) or different for half of them (balanced)? A classical computer has to try more than one input; this circuit needs one run. The CNOT in the middle is the hidden function, here f(x) = x, which is balanced. q0 ends at 1, which means balanced. Delete the CNOT to make f constant, and q0 ends at 0.',
		build: () => [
			op('x', 0, [1]),
			op('h', 1, [0]),
			op('h', 1, [1]),
			op('x', 2, [1], { controls: [0] }),
			op('h', 3, [0]),
			op('h', 3, [1])
		]
	},
	{
		id: 'grover',
		name: 'Grover search',
		qubits: 2,
		summary: 'Finds 1 marked item out of 4 in one step',
		detail:
			'H on both qubits gives all four answers the same chance. The controlled-Z marks the answer 11 by flipping its sign; no probability changes yet. The block after it (H, X, controlled-Z, X, H) reflects every amplitude about the average, which makes the marked one grow and the others cancel. With two qubits, one round finds 11 with certainty.',
		zones: [
			{ name: 'Superposition', startColumn: 0, endColumn: 0 },
			{ name: 'Oracle: marks 11', startColumn: 1, endColumn: 1 },
			{ name: 'Diffuser: amplifies 11', startColumn: 2, endColumn: 6 }
		],
		build: () => [
			op('h', 0, [0]),
			op('h', 0, [1]),
			op('z', 1, [1], { controls: [0] }),
			op('h', 2, [0]),
			op('h', 2, [1]),
			op('x', 3, [0]),
			op('x', 3, [1]),
			op('z', 4, [1], { controls: [0] }),
			op('x', 5, [0]),
			op('x', 5, [1]),
			op('h', 6, [0]),
			op('h', 6, [1])
		]
	},
	{
		id: 'teleport',
		name: 'Teleportation',
		qubits: 3,
		summary: "Moves q0's state onto q2",
		detail:
			"RY(π/3) gives q0 a state to send, one that measures 1 a quarter of the time. q1 and q2 become a Bell pair, then q0 and q1 are entangled and turned back. The last two gates are the corrections: X on q2 if q1 is 1, Z on q2 if q0 is 1. Compare q2's Bloch sphere with q0's at the start: it's the same state. q0's own state is gone, so nothing was copied.",
		build: () => [
			op('ry', 0, [0], { param: Math.PI / 3 }),
			op('h', 0, [1]),
			op('x', 1, [2], { controls: [1] }),
			op('x', 2, [1], { controls: [0] }),
			op('h', 3, [0]),
			op('x', 4, [2], { controls: [1] }),
			op('z', 5, [2], { controls: [0] })
		]
	},
	{
		id: 'qft3',
		name: 'QFT-3',
		qubits: 3,
		summary: 'The Quantum Fourier Transform on 3 qubits',
		detail:
			'The QFT is the core of phase estimation and of Shor’s algorithm. It turns a number into phases: every outcome becomes equally likely, and the number is stored in how fast the phase turns from one qubit to the next. The input here is X on q2. Look at the Bloch spheres afterwards: all three arrows are on the equator, each turned by a different angle. The SWAP at the end puts the qubits back in the usual order.',
		build: () => [
			op('x', 0, [2]),
			op('h', 1, [0]),
			op('p', 2, [0], { controls: [1], param: Math.PI / 2 }),
			op('p', 3, [0], { controls: [2], param: Math.PI / 4 }),
			op('h', 4, [1]),
			op('p', 5, [1], { controls: [2], param: Math.PI / 2 }),
			op('h', 6, [2]),
			op('swap', 7, [0, 2])
		]
	}
];

export function exampleCircuit(example: Example): CircuitIR {
	return {
		version: '1.0',
		registers: { q: example.qubits, c: example.qubits },
		qubitLabels: Array.from({ length: example.qubits }, (_, i) => `Qubit ${i}`),
		operations: example.build(),
		...(example.zones && {
			zones: example.zones.map((z) => ({ id: crypto.randomUUID(), ...z }))
		})
	};
}
