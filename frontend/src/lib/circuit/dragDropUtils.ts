import { qubitLimit } from '$lib/qec/stores';
import type {
	CircuitIR,
	UnitaryOperation,
	MeasureOperation,
	CircuitOperation,
	GateData
} from '../IR/schema';
import { writable, get } from 'svelte/store';
import { circuitIR, simulationResult } from '../IR/stores';
import { isDragging, armedGate } from '../stores/uiStores';
import {
	insertOperation,
	updateOperation,
	removeOperation,
	setNumQubitsIR
} from '../IR/operations';
import { simulateMultipleQubits } from './simulator';
import { UNITARY_GATE_IDS, isGateId, isParametricGate } from '../quantum/gates';

// Only for the UI: remembers controls placed in a column before there is any unitary op in it
export const pendingControls = writable<Map<number, number[]>>(new Map());

// Only for the UI: remembers anti-controls placed in a column before there is any unitary op in it
export const pendingAntiControls = writable<Map<number, number[]>>(new Map());

// Only for the UI: when an angle gate (RX/RY/RZ) or a SWAP gate is dropped, it is
// added with a default value, and its id is stored here so the board can open the
// small edit box for it (the same one used for right-click edit). Null = nothing to open.
export const editGateRequest = writable<string | null>(null);

// Default rotation angle for a newly dropped RX/RY/RZ gate (π/2).
const DEFAULT_ROTATION = Math.PI / 2;

/*──────────────────────── simulation ────────────────────*/

export function triggerSimulation(ir: CircuitIR) {
	simulationResult.set(simulateMultipleQubits(ir));
}

/*──────────────────────── helpers ───────────────────────*/

export function findNextAvailableColumn(ir: CircuitIR, qubit: number): number {
	const cols = ir.operations
		.filter((op) => 'targets' in op && (op.targets as number[]).includes(qubit))
		.map((op) => op.column);
	return cols.length ? Math.max(...cols) + 1 : 0;
}

function canonicalGate(gateType: string): string {
	return gateType.toLowerCase();
}

function isCellOccupied(ir: CircuitIR, col: number, qubit: number, excludeId?: string): boolean {
	return ir.operations.some(
		(op) =>
			op.column === col &&
			'targets' in op &&
			(op.targets as number[]).includes(qubit) &&
			(excludeId ? op.id !== excludeId : true)
	);
}

// Joins the waiting controls/anti-controls for a column with the ones already
// on other unitary ops in that column.
function collectControlsInColumn(
	ir: CircuitIR,
	col: number,
	pending: Map<number, number[]>,
	antiPending: Map<number, number[]>,
	excludeId?: string
): { controls: number[]; antiControls: number[] } {
	const controls = new Set(pending.get(col) ?? []);
	const antiControls = new Set(antiPending.get(col) ?? []);
	for (const op of ir.operations) {
		if (op.kind === 'unitary' && op.column === col && op.id !== excludeId) {
			(op as UnitaryOperation).controls.forEach((c) => controls.add(c));
			(op as UnitaryOperation).antiControls.forEach((c) => antiControls.add(c));
		}
	}
	return { controls: [...controls], antiControls: [...antiControls] };
}

// Removes the waiting controls/anti-controls for a column once a newly added
// operation has used them.
function consumePendingControls(col: number, controls: number[], antiControls: number[]) {
	if (controls.length > 0) {
		pendingControls.update((map) => {
			const next = new Map(map);
			next.delete(col);
			return next;
		});
	}
	if (antiControls.length > 0) {
		pendingAntiControls.update((map) => {
			const next = new Map(map);
			next.delete(col);
			return next;
		});
	}
}

// Shared drop handler for angle gates (RX/RY/RZ/P …). Adds the gate with a
// default angle, then opens the small edit box so the user can change it.
function dropParametricGate(
	gate: UnitaryOperation['gate'],
	col: number,
	qubit: number,
	ir: CircuitIR,
	pending: Map<number, number[]>,
	antiPending: Map<number, number[]>
) {
	const occupied = isCellOccupied(ir, col, qubit);
	if (occupied) {
		console.warn(`Cell (${col}, q=${qubit}) is occupied.`);
		return;
	}

	const { controls, antiControls } = collectControlsInColumn(ir, col, pending, antiPending);

	const unitaryOp: UnitaryOperation = {
		id: crypto.randomUUID(),
		kind: 'unitary',
		gate,
		column: col,
		targets: [qubit],
		controls,
		antiControls,
		params: [DEFAULT_ROTATION]
	};
	insertOperation(unitaryOp);
	consumePendingControls(col, pending.get(col) ?? [], antiPending.get(col) ?? []);
	triggerSimulation(get(circuitIR));
	editGateRequest.set(unitaryOp.id);
}

// Picks the second qubit for a newly dropped SWAP: first try the wire next to it,
// then any other free cell in the column. Returns null if the column has no room.
function pickSwapPartner(ir: CircuitIR, col: number, qubit: number): number | null {
	const q = ir.registers.q;
	const preferred = qubit + 1 < q ? qubit + 1 : qubit - 1;
	const candidates = [preferred, ...Array.from({ length: q }, (_, i) => i)];
	for (const c of candidates) {
		if (c < 0 || c >= q || c === qubit) continue;
		if (!isCellOccupied(ir, col, c)) return c;
	}
	return null;
}

// Shared drop handler for CONTROL/ANTI_CONTROL. Attaches to the ops already in
// the column, or keeps the qubit in the waiting list if there is no op yet.
function applyControlToColumn(
	field: 'controls' | 'antiControls',
	store: typeof pendingControls,
	col: number,
	qubit: number,
	ir: CircuitIR
) {
	const existingOps = ir.operations.filter(
		(op) => op.kind === 'unitary' && op.column === col
	) as UnitaryOperation[];

	if (existingOps.length > 0) {
		for (const existingOp of existingOps) {
			if (!existingOp[field].includes(qubit)) {
				updateOperation(
					existingOp.id,
					(op) =>
						({
							...op,
							[field]: [...(op as UnitaryOperation)[field], qubit]
						}) as CircuitOperation
				);
			}
		}
	} else {
		store.update((map) => {
			const next = new Map(map);
			const existing = next.get(col) ?? [];
			if (!existing.includes(qubit)) next.set(col, [...existing, qubit]);
			return next;
		});
	}
	triggerSimulation(get(circuitIR));
}

/*──────────────────────── drag helpers ──────────────────*/

export function handleGateDragStart(e: DragEvent, id: string, gateType?: string, qubit?: number) {
	const isCopy = e.ctrlKey || e.metaKey;
	const dragData: GateData = { source: 'wire', gateId: id, isCopy, gateType, qubit };
	e.dataTransfer?.setData('application/json', JSON.stringify(dragData));
	isDragging.set(true);

	document.querySelectorAll('.gate.copying').forEach((el) => el.classList.remove('copying'));
	if (isCopy) {
		const gateEl = document.querySelector(`[data-gate-id="${id}"]`);
		if (gateEl) gateEl.classList.add('copying');
	}
}

export function handleDragOver(e: DragEvent) {
	e.preventDefault();
}

/*──────────────────────── tap-to-place ──────────────────*/

// Selects a gate that is already on the board so it can be moved by tapping.
// Touch screens have no usable HTML5 drag, so moving a placed gate works like
// the palette's tap-to-place: tap the gate, then tap where it should go.
// `gateType`/`qubit` are only set for control dots, because they move
// differently (all the dots that belong together move at once).
export function armGateForMove(gateId: string, gateType?: string, qubit?: number) {
	armedGate.set({ source: 'wire', gateId, gateType, qubit });
}

export function disarmGate() {
	armedGate.set(null);
}

// Mobile tap-to-place: places the selected gate at (col, qubit). It does this by
// sending a fake drop event through the normal handleDrop code, so adding a new
// wire, controls, SWAP and angle gates all work exactly like a real drag-drop
// (including opening the small edit box for RX/RY/RZ/SWAP).
//
// A gate from the palette stays selected, so you can keep tapping to place more
// of it. A gate moved from the board is unselected, because it has reached its
// spot and a second tap somewhere else should not move it again.
export function placeArmedGate(col: number, qubit: number) {
	const armed = get(armedGate);
	if (!armed) return;
	// A palette gate is identified by its type, a board gate by its id.
	if (armed.source === 'palette' ? !armed.gateType : !armed.gateId) return;

	const syntheticEvent = {
		preventDefault: () => {},
		dataTransfer: { getData: () => JSON.stringify(armed) }
	} as unknown as DragEvent;

	handleDrop(syntheticEvent, col, qubit);

	if (armed.source === 'wire') armedGate.set(null);
}

/*──────────────────────── drop logic ────────────────────*/

export function handleDrop(e: DragEvent, col: number, qubit: number) {
	e.preventDefault();
	isDragging.set(false);

	const raw = e.dataTransfer?.getData('application/json');
	if (!raw) return;

	const parsed = JSON.parse(raw) as GateData;
	const ir = get(circuitIR);
	const pending = get(pendingControls);
	const antiPending = get(pendingAntiControls);

	/*─── Ghost wire drop: add more qubits ───*/
	if (qubit === ir.registers.q && ir.registers.q < get(qubitLimit)) {
		setNumQubitsIR(ir.registers.q + 1);
		const freshIR = get(circuitIR);

		if (parsed.source === 'palette' && parsed.gateType) {
			_dropPaletteGate(parsed.gateType, col, qubit, freshIR, pending, antiPending);
		} else if (parsed.source === 'wire' && parsed.gateId) {
			updateOperation(
				parsed.gateId,
				(op) => ({ ...op, column: col, targets: [qubit] }) as CircuitOperation
			);
			triggerSimulation(get(circuitIR));
		}
		return;
	}

	/*─── Move / copy existing gate ───*/
	if (parsed.source === 'wire' && parsed.gateId) {
		// Dragging a control/anti-control dot: move all the gates that belong with it to the new column
		const isControlDrag =
			(parsed.gateType === 'CONTROL' || parsed.gateType === 'ANTI_CONTROL') &&
			parsed.qubit !== undefined;
		if (isControlDrag) {
			const field = parsed.gateType === 'CONTROL' ? 'controls' : 'antiControls';
			const controlQubit = parsed.qubit as number;
			const sourceOp = ir.operations.find((op) => op.id === parsed.gateId);
			if (!sourceOp) return;
			const sourceCol = sourceOp.column;
			const siblings = ir.operations.filter(
				(op) =>
					op.kind === 'unitary' &&
					op.column === sourceCol &&
					(op as UnitaryOperation)[field].includes(controlQubit)
			);
			for (const sib of siblings) {
				const targetQubit = (sib as UnitaryOperation).targets[0];
				if (isCellOccupied(ir, col, targetQubit, sib.id)) {
					console.warn(`Cell (${col}, q=${targetQubit}) is occupied.`);
					return;
				}
			}
			for (const sib of siblings) {
				updateOperation(sib.id, (op) => ({ ...op, column: col }) as CircuitOperation);
			}
			triggerSimulation(get(circuitIR));
			return;
		}

		// SWAP gate: both targets move together, only the column changes
		const draggedOp = ir.operations.find((op) => op.id === parsed.gateId);
		const isSwap = draggedOp?.kind === 'unitary' && (draggedOp as UnitaryOperation).gate === 'swap';
		if (isSwap && draggedOp) {
			const swapOp = draggedOp as UnitaryOperation;
			for (const target of swapOp.targets) {
				if (isCellOccupied(ir, col, target, swapOp.id)) {
					console.warn(`Cell (${col}, q=${target}) is occupied.`);
					return;
				}
			}
			if (parsed.isCopy) {
				insertOperation({ ...swapOp, id: crypto.randomUUID(), column: col });
			} else {
				updateOperation(parsed.gateId, (op) => ({ ...op, column: col }));
			}
			triggerSimulation(get(circuitIR));
			return;
		}

		const occupied = isCellOccupied(ir, col, qubit, parsed.gateId);
		if (occupied) {
			console.warn(`Cell (${col}, q=${qubit}) is occupied.`);
			return;
		}

		// Gather the waiting and existing controls in the column we are dropping into
		const { controls: allControls, antiControls: allAntiControls } = collectControlsInColumn(
			ir,
			col,
			pending,
			antiPending,
			parsed.gateId
		);

		const mergeControls = (op: CircuitOperation): CircuitOperation => {
			if (op.kind !== 'unitary')
				return {
					...op,
					column: col,
					...('targets' in op ? { targets: [qubit] } : {})
				} as CircuitOperation;
			const base = op as UnitaryOperation;
			const merged = [...new Set([...base.controls, ...allControls])];
			const mergedAnti = [...new Set([...base.antiControls, ...allAntiControls])];
			return { ...base, column: col, targets: [qubit], controls: merged, antiControls: mergedAnti };
		};

		if (parsed.isCopy) {
			const original = ir.operations.find((op) => op.id === parsed.gateId);
			if (!original) return;
			insertOperation({ ...mergeControls(original), id: crypto.randomUUID() } as CircuitOperation);
		} else {
			updateOperation(parsed.gateId, (op) => mergeControls(op));
		}

		consumePendingControls(col, pending.get(col) ?? [], antiPending.get(col) ?? []);

		triggerSimulation(get(circuitIR));
		return;
	}

	/*─── Drop from palette ───*/
	if (parsed.source === 'palette' && parsed.gateType) {
		_dropPaletteGate(parsed.gateType, col, qubit, ir, pending, antiPending);
	}
}

function _dropPaletteGate(
	gateType: string,
	col: number,
	qubit: number,
	ir: CircuitIR,
	pending: Map<number, number[]>,
	antiPending: Map<number, number[]>
) {
	const upperType = gateType.toUpperCase();
	const lowerType = gateType.toLowerCase();

	// Any angle gate (RX/RY/RZ/P …) is dropped with a default angle and opens the small edit box.
	if (isGateId(lowerType) && isParametricGate(lowerType)) {
		dropParametricGate(lowerType, col, qubit, ir, pending, antiPending);
		return;
	}

	if (upperType === 'CONTROL') {
		applyControlToColumn('controls', pendingControls, col, qubit, ir);
		return;
	}

	if (upperType === 'ANTI_CONTROL') {
		applyControlToColumn('antiControls', pendingAntiControls, col, qubit, ir);
		return;
	}

	if (upperType === 'MEASURE') {
		const occupied = isCellOccupied(ir, col, qubit);
		if (occupied) {
			console.warn(`Cell (${col}, q=${qubit}) is occupied.`);
			return;
		}

		const measureOp: MeasureOperation = {
			id: crypto.randomUUID(),
			kind: 'measure',
			gate: 'measure',
			column: col,
			targets: [qubit],
			classicalTargets: [qubit]
		};
		insertOperation(measureOp);
		triggerSimulation(get(circuitIR));
		return;
	}

	if (upperType === 'SWAP') {
		const occupied = isCellOccupied(ir, col, qubit);
		if (occupied) {
			console.warn(`Cell (${col}, q=${qubit}) is occupied.`);
			return;
		}

		if (ir.registers.q < 2 && ir.registers.q < get(qubitLimit)) {
			setNumQubitsIR(ir.registers.q + 1);
			ir = get(circuitIR);
		}

		const secondQubit = pickSwapPartner(ir, col, qubit);
		if (secondQubit === null) {
			console.warn('No free qubit in this column to SWAP with.');
			return;
		}

		const unitaryOp: UnitaryOperation = {
			id: crypto.randomUUID(),
			kind: 'unitary',
			gate: 'swap',
			column: col,
			targets: [qubit, secondQubit],
			controls: [],
			antiControls: [],
			params: []
		};
		insertOperation(unitaryOp);
		triggerSimulation(get(circuitIR));
		editGateRequest.set(unitaryOp.id);
		return;
	}

	// Standard unitary gate
	const occupied = isCellOccupied(ir, col, qubit);
	if (occupied) {
		console.warn(`Cell (${col}, q=${qubit}) is occupied.`);
		return;
	}

	const { controls, antiControls } = collectControlsInColumn(ir, col, pending, antiPending);

	const unitaryOp: UnitaryOperation = {
		id: crypto.randomUUID(),
		kind: 'unitary',
		gate: canonicalGate(gateType) as UnitaryOperation['gate'],
		column: col,
		targets: [qubit],
		controls,
		antiControls,
		params: []
	};
	insertOperation(unitaryOp);
	consumePendingControls(col, pending.get(col) ?? [], antiPending.get(col) ?? []);
	triggerSimulation(get(circuitIR));
}

/*──────────────────────── delete ────────────────────────*/

export function removeGate(id?: string) {
	if (!id) return;
	removeOperation(id);
	isDragging.set(false);
	triggerSimulation(get(circuitIR));
}

/*──────────────────────── palette drop ──────────────────*/

export function handlePaletteDrop(e: DragEvent) {
	e.preventDefault();
	const raw = e.dataTransfer?.getData('application/json');
	if (!raw) return;
	const parsed = JSON.parse(raw) as GateData;
	if (parsed.source === 'wire' && parsed.gateId) removeGate(parsed.gateId);
}

/*──────────────────────── double-click ──────────────────*/

export function handleDoubleClick(data: GateData) {
	const valid = [
		...UNITARY_GATE_IDS.map((g) => g.toUpperCase()),
		'CONTROL',
		'ANTI_CONTROL',
		'MEASURE'
	];

	if (data.source === 'palette' && data.gateType) {
		if (!valid.includes(data.gateType.toUpperCase())) return;
		const ir = get(circuitIR);
		const col = findNextAvailableColumn(ir, 0);
		const pending = get(pendingControls);
		const antiPending = get(pendingAntiControls);
		_dropPaletteGate(data.gateType, col, 0, ir, pending, antiPending);
	} else if (data.source === 'wire' && data.gateId) {
		const isControl = data.gateType === 'CONTROL' || data.gateType === 'ANTI_CONTROL';
		if (isControl && data.qubit !== undefined) {
			const ir = get(circuitIR);
			const sourceOp = ir.operations.find((op) => op.id === data.gateId);
			if (!sourceOp) return;
			const col = sourceOp.column;
			const qubitToRemove = data.qubit;
			const field = data.gateType === 'CONTROL' ? 'controls' : 'antiControls';
			const siblings = ir.operations.filter(
				(op) =>
					op.kind === 'unitary' &&
					op.column === col &&
					(op as UnitaryOperation)[field].includes(qubitToRemove)
			);
			for (const sib of siblings) {
				updateOperation(
					sib.id,
					(op) =>
						({
							...op,
							[field]: (op as UnitaryOperation)[field].filter((c: number) => c !== qubitToRemove)
						}) as CircuitOperation
				);
			}
			triggerSimulation(get(circuitIR));
		} else {
			removeGate(data.gateId);
		}
	}
}
