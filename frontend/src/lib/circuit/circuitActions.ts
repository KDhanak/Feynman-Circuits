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
import { manualSave, resetAutoSaveState } from '$lib/circuit/autoSave';
import { session } from '$lib/auth/session';
import { circuitIR, emptyCircuitIR } from '$lib/IR/stores';
import { setNumQubitsIR } from '$lib/IR/operations';
import { get } from 'svelte/store';
import { QEC_LOGICAL_QUBITS, qecMode, qubitLimit } from '$lib/qec/stores';
import { GATE_REGISTRY, isCliffordGate } from '$lib/quantum/gates';
import type { UnitaryOperation } from '../IR/schema';
import { MAX_COLUMNS } from '$lib/utils/constants';
import { shiftingCircuit } from '$lib/stores/uiStores';
import { exampleCircuit, type Example } from '$lib/examples';

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

/**
 * Saves whatever is on the board, then starts a new circuit.
 *
 * Auto-save runs on a timer, so the last few edits may not be on the server
 * yet when someone starts a new circuit. This puts them there first.
 *
 * Two things this must get right:
 *  - It waits for the save to finish. `startNewCircuit` replaces the id and
 *    the board that the save is still reading, so starting early would save
 *    the new empty circuit over the old one.
 *  - If the save fails, the new circuit is NOT started. Clearing the board
 *    after failing to save the work on it is the one outcome nobody wants.
 *
 * A signed-out user has nowhere to save to, so there is nothing to wait for.
 */
export async function saveThenStartNewCircuit(): Promise<void> {
	if (get(session).status === 'authenticated') {
		try {
			await manualSave();
		} catch {
			showNotification('Could not save this circuit, so the new one was not started.', 'error');
			return;
		}
	}
	startNewCircuit();
}

export type BellState = 'phi+' | 'phi-' | 'psi+' | 'psi-';

export const BELL_LABELS: Record<BellState, string> = {
	'phi+': 'Φ⁺',
	'phi-': 'Φ⁻',
	'psi+': 'Ψ⁺',
	'psi-': 'Ψ⁻'
};

// Which qubits get an X first. All four Bell states come from the same H + CNOT
// circuit. The only difference is the starting state |q0 q1⟩:
// |00⟩ → Φ⁺, |10⟩ → Φ⁻, |01⟩ → Ψ⁺, |11⟩ → Ψ⁻.
const BELL_FLIPS: Record<BellState, { q0: boolean; q1: boolean }> = {
	'phi+': { q0: false, q1: false },
	'phi-': { q0: true, q1: false },
	'psi+': { q0: false, q1: true },
	'psi-': { q0: true, q1: true }
};

export function applyBellPairPreset(state: BellState = 'phi+'): void {
	// A Bell pair needs two qubits, and QEC mode works on one logical qubit.
	if (get(qubitLimit) < 2) {
		showNotification('Bell Pair needs two qubits. QEC mode works on one logical qubit.', 'error');
		return;
	}
	if (get(circuitIR).registers.q < 2) {
		setNumQubitsIR(2);
	}

	const flips = BELL_FLIPS[state];
	const gate = (
		name: 'h' | 'x',
		column: number,
		target: number,
		controls: number[] = []
	): UnitaryOperation => ({
		id: crypto.randomUUID(),
		kind: 'unitary',
		gate: name,
		column,
		targets: [target],
		controls,
		antiControls: [],
		params: []
	});

	circuitIR.update((ir) => {
		const col = Math.max(findNextAvailableColumn(ir, 0), findNextAvailableColumn(ir, 1));
		// The X on q0 has to come before the H. The X on q1 only has to come
		// before the CNOT, so it can share the H's column.
		const hCol = flips.q0 ? col + 1 : col;
		const ops = [
			...(flips.q0 ? [gate('x', col, 0)] : []),
			...(flips.q1 ? [gate('x', col, 1)] : []),
			gate('h', hCol, 0),
			gate('x', hCol + 1, 1, [0])
		];
		const next: CircuitIR = { ...ir, operations: [...ir.operations, ...ops] };
		triggerSimulation(next);
		return next;
	});
	showNotification(`Bell pair ${BELL_LABELS[state]} circuit applied!`, 'success');
}

/**
 * Opens an example as a new circuit. It is not added to the board like the
 * Bell pair, because most examples only work from a fresh |0…0⟩ start.
 *
 * It goes the same way as starting a new circuit: whatever was open is saved
 * first (for a signed-in user), and the example gets its own id, so the
 * circuit that was open is left alone in the library.
 */
export async function loadExample(example: Example): Promise<void> {
	if (get(qubitLimit) < example.qubits) {
		showNotification(
			`${example.name} needs ${example.qubits} qubits. QEC mode works on one logical qubit.`,
			'error'
		);
		return;
	}
	if (get(session).status === 'authenticated') {
		try {
			await manualSave();
		} catch {
			showNotification('Could not save this circuit, so the example was not opened.', 'error');
			return;
		}
	}
	resetAutoSaveState();
	applyCircuit(exampleCircuit(example), { name: example.name });
	showNotification(`Opened the ${example.name} example.`, 'success');
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

		// Zones are stages, so a gate may not move into an earlier stage. Each
		// column belongs to a zone or to the gap between two zones; when the walk
		// reaches a new one, every qubit starts after the last gate so far.
		const zones = ir.zones ?? [];
		const stageOf = (column: number) =>
			zones.find((z) => z.startColumn <= column && column <= z.endColumn)?.id ??
			`gap-${zones.filter((z) => z.startColumn < column).length}`;

		const freeCol = new Array(ir.registers.q).fill(0);
		let stage: string | null = null;
		const newColumns = new Map<string, number[]>(); // zone id → its gates' new columns
		const remapped = sorted.map((op) => {
			const opStage = stageOf(op.column);
			if (opStage !== stage) {
				freeCol.fill(Math.max(0, ...freeCol));
				stage = opStage;
			}
			const qs = spanOf(op);
			const col = qs.length ? Math.max(...qs.map((q) => freeCol[q] ?? 0)) : 0;
			for (const q of qs) freeCol[q] = col + 1;
			newColumns.set(opStage, [...(newColumns.get(opStage) ?? []), col]);
			return { ...op, column: col } as CircuitOperation;
		});

		// Each zone now spans its own gates. A zone with no gates in it is dropped.
		const nextZones = zones.flatMap((z) => {
			const cols = newColumns.get(z.id);
			return cols ? [{ ...z, startColumn: Math.min(...cols), endColumn: Math.max(...cols) }] : [];
		});
		const { zones: _old, ...rest } = ir;
		const next: CircuitIR = {
			...rest,
			operations: remapped,
			...(nextZones.length && { zones: nextZones })
		};
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

/**
 * Whether every gate can move one column in the given direction. Moving left
 * needs the first column to be empty, and moving right needs the last column
 * to be empty, so no gate is ever pushed off the board. Control dots that are
 * not attached to a gate yet count too, because they move with everything else.
 */
export function canShiftCircuit(
	ir: CircuitIR,
	direction: -1 | 1,
	pending: Map<number, number[]>[] = [get(pendingControls), get(pendingAntiControls)]
): boolean {
	const columns = [
		...ir.operations.map((op) => op.column),
		...pending.flatMap((map) => [...map.keys()]),
		...(ir.zones ?? []).flatMap((z) => [z.startColumn, z.endColumn])
	];
	if (columns.length === 0) return false;
	return direction === -1 ? Math.min(...columns) > 0 : Math.max(...columns) < MAX_COLUMNS - 1;
}

/**
 * Moves every gate one column left (-1) or right (1). The gates keep their
 * order, so the simulation result does not change. Moving right leaves the
 * first column empty, which gives room to add a gate in front of the circuit.
 * The board shows it on every screen size. On a phone it is the only way,
 * because dragging the whole circuit is not possible there.
 */
// Must be at least as long as the slide in WireDropeZone's `.shifting` CSS.
const SHIFT_ANIMATION_MS = 250;
let shiftTimer: ReturnType<typeof setTimeout> | undefined;

export function shiftCircuit(direction: -1 | 1): void {
	if (!canShiftCircuit(get(circuitIR), direction)) return;

	// Turn the slide on before the columns change, so the new positions animate.
	// A quick second click restarts the timer, so the slide stays on for it too.
	shiftingCircuit.set(true);
	clearTimeout(shiftTimer);
	shiftTimer = setTimeout(() => shiftingCircuit.set(false), SHIFT_ANIMATION_MS);

	circuitIR.update((ir) => {
		const next: CircuitIR = {
			...ir,
			operations: ir.operations.map(
				(op) => ({ ...op, column: op.column + direction }) as CircuitOperation
			),
			// Zones are columns too, so they move with the gates.
			...(ir.zones && {
				zones: ir.zones.map((z) => ({
					...z,
					startColumn: z.startColumn + direction,
					endColumn: z.endColumn + direction
				}))
			})
		};
		triggerSimulation(next);
		return next;
	});

	// Control dots that are not attached to a gate yet are stored by column
	// number, so they have to move by the same amount as the gates.
	const shiftKeys = (map: Map<number, number[]>) =>
		new Map([...map].map(([col, qubits]) => [col + direction, qubits]));
	pendingControls.update(shiftKeys);
	pendingAntiControls.update(shiftKeys);
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
