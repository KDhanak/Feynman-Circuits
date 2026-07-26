import { describe, test, expect } from 'vitest';
import { simulateMultipleQubits } from '../../src/lib/circuit/simulator';
import type { CircuitIR, UnitaryOperation } from '../../src/lib/IR/schema';

// ─────────────────────────────────────────────────────────────
// Golden tests for simulateMultipleQubits.
//
// These pin down the simulator's current, trusted output for a
// representative set of circuits (every gate, parametric angles,
// swap, single/multi controls, and anti-controls). They exist as
// a regression tripwire for the GATE_REGISTRY-based refactor of
// simulator.ts: if a matrix, sign, or phase convention changes,
// one of these will fail.
// ─────────────────────────────────────────────────────────────

function op(
	partial: Partial<UnitaryOperation> & Pick<UnitaryOperation, 'gate' | 'targets'>
): UnitaryOperation {
	return {
		id: crypto.randomUUID(),
		kind: 'unitary',
		column: 0,
		controls: [],
		antiControls: [],
		params: [],
		...partial
	};
}

function circuit(numQubits: number, operations: UnitaryOperation[]): CircuitIR {
	return {
		version: '1.0',
		registers: { q: numQubits, c: numQubits },
		qubitLabels: Array.from({ length: numQubits }, (_, i) => `q${i}`),
		operations
	};
}

const round = (n: number, dp = 6) => Number(n.toFixed(dp));

// Reduces a state vector down to {basisString: [re, im]} for amplitudes
// above a tiny floating-point threshold, so snapshots stay readable.
function snapshot(result: ReturnType<typeof simulateMultipleQubits>, numQubits: number) {
	const out: Record<string, [number, number]> = {};
	for (const [basis, prob] of Object.entries(result.probabilities)) {
		if (prob > 1e-9) out[basis] = [round(prob), 0];
	}
	return { probabilities: out, formattedState: result.formattedState };
}

describe('simulateMultipleQubits — golden snapshots', () => {
	test('single-qubit gates on |0>', () => {
		const gates: UnitaryOperation['gate'][] = ['x', 'y', 'z', 'h', 's', 't'];
		const snapshots = gates.map((gate) => {
			const result = simulateMultipleQubits(circuit(1, [op({ gate, targets: [0] })]));
			return [gate, snapshot(result, 1)];
		});

		expect(snapshots).toMatchSnapshot();
	});

	test('rx/ry/rz with non-trivial angles', () => {
		const angle = Math.PI / 3;
		const gates: UnitaryOperation['gate'][] = ['rx', 'ry', 'rz'];
		const snapshots = gates.map((gate) => {
			const result = simulateMultipleQubits(
				circuit(1, [op({ gate, targets: [0], params: [angle] })])
			);
			return [gate, snapshot(result, 1)];
		});

		expect(snapshots).toMatchSnapshot();
	});

	test('swap entangled-looking pair', () => {
		const result = simulateMultipleQubits(
			circuit(2, [
				op({ gate: 'x', targets: [0] }),
				op({ gate: 'swap', targets: [0, 1], column: 1 })
			])
		);

		expect(snapshot(result, 2)).toMatchSnapshot();
	});

	test('single-control CNOT (Bell state)', () => {
		const result = simulateMultipleQubits(
			circuit(2, [
				op({ gate: 'h', targets: [0] }),
				op({ gate: 'x', targets: [1], controls: [0], column: 1 })
			])
		);

		expect(snapshot(result, 2)).toMatchSnapshot();
	});

	test('multi-control Toffoli (CCX)', () => {
		const result = simulateMultipleQubits(
			circuit(3, [
				op({ gate: 'x', targets: [0] }),
				op({ gate: 'x', targets: [1], column: 1 }),
				op({ gate: 'x', targets: [2], controls: [0, 1], column: 2 })
			])
		);

		expect(snapshot(result, 3)).toMatchSnapshot();
	});

	test('anti-control gate (X fires only when control is |0>)', () => {
		const result = simulateMultipleQubits(
			circuit(2, [op({ gate: 'x', targets: [1], antiControls: [0] })])
		);

		expect(snapshot(result, 2)).toMatchSnapshot();
	});

	test('controlled rotation (RY with control)', () => {
		const result = simulateMultipleQubits(
			circuit(2, [
				op({ gate: 'x', targets: [0] }),
				op({ gate: 'ry', targets: [1], controls: [0], params: [Math.PI / 2], column: 1 })
			])
		);

		expect(snapshot(result, 2)).toMatchSnapshot();
	});

	test('phase gate P(π): H·P(π)·H on |0> equals Z (flips to |1>)', () => {
		const result = simulateMultipleQubits(
			circuit(1, [
				op({ gate: 'h', targets: [0] }),
				op({ gate: 'p', targets: [0], params: [Math.PI], column: 1 }),
				op({ gate: 'h', targets: [0], column: 2 })
			])
		);

		expect(snapshot(result, 1)).toMatchSnapshot();
	});

	test('controlled-P(π) (QFT building block): flips target when control is set', () => {
		const result = simulateMultipleQubits(
			circuit(2, [
				op({ gate: 'x', targets: [0] }), // control = |1>
				op({ gate: 'h', targets: [1], column: 1 }), // target -> |+>
				op({ gate: 'p', targets: [1], controls: [0], params: [Math.PI], column: 2 }), // |+> -> |->
				op({ gate: 'h', targets: [1], column: 3 }) // |-> -> |1>
			])
		);

		expect(snapshot(result, 2)).toMatchSnapshot();
	});
});
