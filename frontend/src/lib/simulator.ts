import type { CircuitState, SimulationResult, GateInstance, MatrixGateType } from "./stores";
import { circuit, SimulationResults } from '../lib/stores';
import { createComplex, formatQuantumState, formatQuantumStatePolar, magnitudeSquared } from "./quantum/complex";
import { type QuantumState, createState } from "./quantum/vector";
import { applyMatrix, extendGateMatrix, computeMultiControlledUMatrix } from "./quantum/matrix";
import { GATE_MAP } from "./quantum/gates";
import { get } from "svelte/store";

/**
 * Simulates a quantum circuit with a single qubit.
 * Applies the gates in the circuit to the initial state |0⟩.
 * @param circuit - The CircuitState object representing the circuit.
 * @returns The simulation result containing probabilities of measuring |0⟩ and |1⟩.
 */
export function simulateSingleQubit(circuit: CircuitState): SimulationResult {
	// Initial state: |0⟩ = [1, 0]
	let state: QuantumState = createState([
		createComplex(1, 0),
		createComplex(0, 0),
	]);

	const gatesInColumnOrder = [...circuit.gates].sort(
		(a, b) => a.columnIndex - b.columnIndex
	);

	// Apply gates sequentially
	for (const gate of gatesInColumnOrder) {
		if (gate.gateType !== 'CONTROL') {
			const gateDef = GATE_MAP[gate.gateType as MatrixGateType];
			if (gateDef && gateDef.matrix.length > 0) {
				state = applyMatrix(gateDef.matrix, state);

			} else {
				console.warn(`Skipping gate: ${gate.gateType} not supported`);
			}
		}
	}

	// Calculate probabilities
	const probabilities: { [state: string]: number } = {
		'0': magnitudeSquared(state[0]),
		'1': magnitudeSquared(state[1]),
	};

	const formattedState = formatQuantumState(state);
	const formattedStatePolar = formatQuantumStatePolar(state);

	return { probabilities, formattedState, formattedStatePolar };
}


export function simulateMultipleQubits(circuit: CircuitState): SimulationResult {
	const { numQubits, gates } = circuit;
	console.log('[simulateMultipleQubits] numQubits=', numQubits, 'gates=', JSON.parse(JSON.stringify(gates)));
	if (numQubits < 2) {
		throw new Error('Multi-Qubit simulator requires at least 2 qubits');
	}

	const dim = 1 << numQubits;
	let state: QuantumState = createState(Array(dim).fill(null).map(() => createComplex(0, 0)));
	state[0] = createComplex(1, 0);

	const maxColumn = gates.length ? Math.max(...gates.map(g => g.columnIndex)) + 1 : 0;
	console.log('[simulateMultipleQubits] maxColumn=', maxColumn);
	const columns = Array.from({ length: maxColumn }, (_, colIndex) =>
		gates.filter(g => g.columnIndex === colIndex)
	);

	for (const colGates of columns) {
		// Step 1: Extract CONTROL gates
		const controlGates = colGates.filter(g => g.gateType === 'CONTROL');


		// Step 2: Aggregate CONTROLs by targetQubit (NOT create pairs!)
		const controlsByTarget = new Map<number, number[]>();
		for (const ctrl of controlGates) {
			const targets = ctrl.targetQubits ?? (ctrl.targetQubit !== undefined ? [ctrl.targetQubit] : []);
			for (const targetQubit of targets) {
				const arr = controlsByTarget.get(targetQubit) ?? [];
				arr.push(ctrl.qubit);
				controlsByTarget.set(targetQubit, arr);
			}
		}

		// Example: If you have:
		//   CONTROL(qubit=0, targetQubit=2)
		//   CONTROL(qubit=1, targetQubit=2)
		//   X(qubit=2)
		//
		// After aggregation, controlsByTarget = {
		//   2: [0, 1]  ← ALL controls targeting qubit 2, collected in array
		// }

		// Step 3: Build set of involved qubits (for skipping independent gates)
		const controlledQubits = new Set<number>();
		for (const [t, ctrls] of controlsByTarget) {
			controlledQubits.add(t);              // Add target qubit
			ctrls.forEach(c => controlledQubits.add(c));  // Add ALL control qubits
		}

		// Step 4: Apply independent gates (unchanged)
		for (const gate of colGates) {
			if (gate.gateType === 'CONTROL' || controlledQubits.has(gate.qubit)) continue;

			const gateDef = GATE_MAP[gate.gateType as MatrixGateType];
			if (gateDef && gateDef.matrix.length > 0) {
				// Build full-system matrix that applies gateDef.matrix to gate.qubit
				const matrix = extendGateMatrix(gateDef.matrix, gate.qubit, numQubits);
				console.debug(`[simulateMultipleQubits] Applying ${gate.gateType} on qubit ${gate.qubit}`);
				state = applyMatrix(matrix, state);
			} else {
				console.warn(`Invalid or unsupported gate type: ${gate.gateType}`);
			}
		}

		// Step 5: Apply controlled gates (ONE per target, with ALL controls)
		for (const [targetQubit, controlQubits] of controlsByTarget) {
			// Find the target gate (X, Y, H, etc. on this qubit)
			const targetGate = colGates.find(g => g.qubit === targetQubit && g.gateType !== 'CONTROL');
			if (!targetGate) {
				console.warn(`No target gate found for CONTROL(s) on qubit ${targetQubit}`);
				continue;
			}

			// Get the gate definition from GATE_MAP (no hardcoding!)
			const gateDef = GATE_MAP[targetGate.gateType as MatrixGateType];
			if (!gateDef || gateDef.matrix.length === 0) {
				console.warn(`Unsupported target gate: ${targetGate.gateType}`);
				continue;
			}

			// ✅ Build ONE multi-control matrix with ALL controls
			//    Instead of:    computeControlledUMatrix(0, 2, ...)  [1 control]
			//    We now call:   computeMultiControlledUMatrix([0, 1], 2, ...)  [2+ controls]
			const matrix = computeMultiControlledUMatrix(controlQubits, targetQubit, numQubits, gateDef.matrix);
			state = applyMatrix(matrix, state);
			console.log(state);
		}

		// CONSEQUENCE:
		// For the same example:
		//   CONTROL(qubit=0, targetQubit=2)
		//   CONTROL(qubit=1, targetQubit=2)
		//   X(qubit=2)
		//
		// Now applies ONE Toffoli operation:
		// computeMultiControlledUMatrix([0, 1], 2, 3, X_GATE.matrix)
		//
		// ✅ CORRECT! X flips ONLY IF both qubits 0 AND 1 are |1⟩
	}

	const probabilities = Object.fromEntries(
		state.map((amplitude, idx) => {
			const bitString = idx.toString(2).padStart(numQubits, '0');
			const prob = magnitudeSquared(amplitude);
			return [bitString, prob] as [string, number];
		})
	)

	const formattedState = formatQuantumState(state);
	const formattedStatePolar = formatQuantumStatePolar(state);
	return { probabilities, formattedState, formattedStatePolar };
}

export function resetCircuit() {
	const current = get(circuit);
	const qubits = current.numQubits;
	circuit.set({
		numQubits: qubits,
		gates: []
	});

	const probabilities: { [state: string]: number } = {};
	for (let i = 0; i < 1 << qubits; i++) {
		probabilities[i.toString(2).padStart(qubits, '0')] = i === 0 ? 1 : 0;
	}

	SimulationResults.set({
		probabilities,
		formattedState: `1.00|${'0'.repeat(qubits)}⟩`
	});
}
