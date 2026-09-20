import {
	importCircuit,
	exportToOpenQasm,
	importFromOpenQasm,
	exportToQiskit,
	importFromQiskit,
	exportToQSharp,
	importFromQSharp
} from './IE';
import { applyCircuit } from '$lib/circuit/applyCircuit';
import { buildCanonicalString } from '$lib/circuit/circuitDataModal';
import type { CircuitIR, CircuitOperation } from '../IR/schema';
import {
	triggerSimulation,
	findNextAvailableColumn,
	pendingControls,
	pendingAntiControls
} from '$lib/circuit/dragDropUtils';
import { showNotification } from '../utils/notificationUtils';
import { resetAutoSaveState } from '$lib/circuit/autoSave';
import { circuitIR, emptyCircuitIR } from '$lib/IR/stores';
import { setNumQubitsIR } from '$lib/IR/operations';
import { get } from 'svelte/store';
import { QEC_LOGICAL_QUBITS, qecMode, qubitLimit } from '$lib/qec/stores';
import { GATE_REGISTRY, isCliffordGate } from '$lib/quantum/gates';
import type { UnitaryOperation } from '../IR/schema';

/**
 * Turning on QEC mode limits the palette to Clifford gates, because QEC runs
 * are simulated by Stim, and a stabiliser simulator cannot handle anything
 * else. Non-Clifford gates already on the board are left where they are
 * (quietly deleting the user's work would be worse), but the user is told,
 * because that circuit will not run in Stim.
 */
export function toggleQecMode(): void {
	const next = !get(qecMode);
	qecMode.set(next);
	if (!next) return;
	const offenders = [
		...new Set(
			get(circuitIR)
				.operations.filter(
					(op): op is UnitaryOperation => op.kind === 'unitary' && !isCliffordGate(op.gate)
				)
				.map((op) => GATE_REGISTRY[op.gate].label)
		)
	];
	// Nothing is deleted. Extra wires stay where they are, like non-Clifford
	// gates do: the user is told, and can remove them with the minus button.
	const problems: string[] = [];
	if (offenders.length) {
		problems.push(
			`non-Clifford gates (${offenders.join(', ')}), which a stabiliser simulator cannot run`
		);
	}
	const qubits = get(circuitIR).registers.q;
	if (qubits > QEC_LOGICAL_QUBITS) {
		problems.push(`${qubits} qubits, but QEC mode works on one logical qubit`);
	}
	if (problems.length) {
		showNotification(
			`QEC mode on. The circuit still has ${problems.join(', and ')}.`,
			'error',
			5000
		);
	}
}

export async function copyToClipboard(content: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(content);
		showNotification('Copied to clipboard!', 'success');
	} catch {
		showNotification('Failed to copy text. Please copy manually.', 'error');
	}
}

function downloadFile(filename: string, content: string, mimeType = 'text/plain') {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

export function downloadCircuit(name: string, ir: CircuitIR): void {
	const content = buildCanonicalString(ir);
	downloadFile(`${name}.cir`, content, 'text/plain');
	showNotification('Circuit downloaded!', 'success');
}

export function importJson(jsonText: string): void {
	let ir: CircuitIR;
	try {
		const result = importCircuit(JSON.parse(jsonText));
		if (!result.ok) {
			showNotification(result.error, 'error');
			return;
		}
		ir = result.data;
	} catch {
		showNotification('Invalid JSON format', 'error');
		return;
	}

	try {
		applyCircuit(ir);
	} catch {
		showNotification('Circuit imported but simulation failed', 'error');
	}
	showNotification('Circuit imported successfully!', 'success');
}

export function downloadCircuitAsOpenQasm(
	name: string,
	ir: CircuitIR,
	version: '2.0' | '3.0' = '2.0'
): void {
	const content = exportToOpenQasm(ir, { version, includeComments: true });
	downloadFile(`${name}.qasm`, content, 'text/plain');
	showNotification(`Circuit exported as OpenQasm ${version}!`, 'success');
}

/**
 * Starts a brand new circuit on the board.
 *
 * This is not the same as clearing the board. Clearing takes the gates off but
 * keeps the circuit's id and name, so for a signed-in user the next edit
 * auto-saves the new work over the circuit they had open. Starting a new
 * circuit hands the board a fresh id and an Untitled name, so whatever was
 * open before is left alone in their library.
 *
 * Resetting auto-save's own state matters too: it clears `nameResolved`, so
 * the first save asks the server for a free "Untitled Circuit N" instead of
 * keeping the last circuit's name, and it clears any run of failed saves.
 */
export function startNewCircuit(): void {
	resetAutoSaveState();
	applyCircuit(emptyCircuitIR(), { name: 'Untitled Circuit' });
	showNotification('Started a new circuit.', 'success');
}

export function applyBellPairPreset(): void {
	// A Bell pair needs two qubits, and QEC mode works on one logical qubit.
	if (get(qubitLimit) < 2) {
		showNotification('Bell Pair needs two qubits. QEC mode works on one logical qubit.', 'error');
		return;
	}
	if (get(circuitIR).registers.q < 2) {
		setNumQubitsIR(2);
	}

	circuitIR.update((ir) => {
		const col = Math.max(findNextAvailableColumn(ir, 0), findNextAvailableColumn(ir, 1));
		const next: CircuitIR = {
			...ir,
			operations: [
				...ir.operations,
				{
					id: crypto.randomUUID(),
					kind: 'unitary',
					gate: 'h',
					column: col,
					targets: [0],
					controls: [],
					antiControls: [],
					params: []
				},
				{
					id: crypto.randomUUID(),
					kind: 'unitary',
					gate: 'x',
					column: col + 1,
					targets: [1],
					controls: [0],
					antiControls: [],
					params: []
				}
			]
		};
		triggerSimulation(next);
		return next;
	});
	showNotification('Bell pair circuit applied!', 'success');
}

/**
 * Pushes the circuit to the left by removing empty columns (ASAP scheduling:
 * every gate goes as early as possible).
 *
 * Each operation moves to the first column where its whole vertical range is
 * free. A multi-qubit gate (controls, SWAP) draws a connector line across every
 * row between its top qubit and its bottom qubit, so we keep that whole range
 * free, not just the two ends. Otherwise a gate on a qubit in the middle of the
 * same column would be drawn on top of the connector line. We go through the
 * operations in column order, so each qubit keeps its gates in the same order
 * and the simulation result does not change.
 */
export function compactCircuit(): void {
	if (get(circuitIR).operations.length === 0) {
		showNotification('Nothing to compact.', 'error');
		return;
	}

	const qubitsOf = (op: CircuitOperation): number[] =>
		op.kind === 'unitary'
			? [...op.targets, ...op.controls, ...op.antiControls]
			: 'targets' in op
				? (op.targets as number[])
				: [];

	// The rows a gate takes up on screen: every qubit from its lowest to its
	// highest qubit (both included), so the connector lines are covered too.
	const spanOf = (op: CircuitOperation): number[] => {
		const qs = qubitsOf(op);
		if (qs.length === 0) return [];
		const min = Math.min(...qs);
		const max = Math.max(...qs);
		return Array.from({ length: max - min + 1 }, (_, i) => min + i);
	};

	circuitIR.update((ir) => {
		// Go through the operations from left to right by their current column (the
		// sort is stable, so ops in the same column keep their current order).
		const sorted = [...ir.operations].sort((a, b) => a.column - b.column);

		const freeCol = new Array(ir.registers.q).fill(0);
		const remapped = sorted.map((op) => {
			const qs = spanOf(op);
			const col = qs.length ? Math.max(...qs.map((q) => freeCol[q] ?? 0)) : 0;
			for (const q of qs) freeCol[q] = col + 1;
			return { ...op, column: col } as CircuitOperation;
		});

		const next: CircuitIR = { ...ir, operations: remapped };
		triggerSimulation(next);
		return next;
	});

	// Control dots that are not attached to a gate yet are stored by column number,
	// and we just changed the column numbers. So remove them, or they would stay at
	// the wrong positions.
	pendingControls.set(new Map());
	pendingAntiControls.set(new Map());

	showNotification('Circuit compacted!', 'success');
}

export function importOpenQasm(qasmText: string): void {
	const result = importFromOpenQasm(qasmText);
	if (!result.ok) {
		showNotification(result.error, 'error');
		return;
	}

	const ir = result.data;
	try {
		applyCircuit(ir);
	} catch {
		showNotification('Circuit imported but simulation failed', 'error');
	}
	showNotification('Circuit imported from OpenQasm successfully!', 'success');
}

export function downloadCircuitAsQiskit(name: string, ir: CircuitIR): void {
	const content = exportToQiskit(ir, { includeComments: true });
	downloadFile(`${name}.py`, content, 'text/plain');
	showNotification('Circuit exported as Qiskit Python!', 'success');
}

export function importQiskit(pythonText: string): void {
	const result = importFromQiskit(pythonText);
	if (!result.ok) {
		showNotification(result.error, 'error');
		return;
	}

	const ir = result.data;
	try {
		applyCircuit(ir);
	} catch {
		showNotification('Circuit imported but simulation failed', 'error');
	}
	showNotification('Circuit imported from Qiskit successfully!', 'success');
}

export function downloadCircuitAsQSharp(name: string, ir: CircuitIR): void {
	const content = exportToQSharp(ir, { includeComments: true });
	downloadFile(`${name}.qs`, content, 'text/plain');
	showNotification('Circuit exported as Q#!', 'success');
}

export function importQSharp(qsharpText: string): void {
	const result = importFromQSharp(qsharpText);
	if (!result.ok) {
		showNotification(result.error, 'error');
		return;
	}

	const ir = result.data;
	try {
		applyCircuit(ir);
	} catch {
		showNotification('Circuit imported but simulation failed', 'error');
	}
	showNotification('Circuit imported from Q# successfully!', 'success');
}
