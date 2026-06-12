import type { CircuitIR, UnitaryOperation, MeasureOperation, CircuitOperation, GateData } from '../IR/schema';
import { writable, get } from 'svelte/store';
import { circuitIR, simulationResult } from '../IR/stores';
import { isDragging } from '../stores/uiStores';
import { insertOperation, updateOperation, removeOperation, setNumQubitsIR } from '../IR/operations';
import { simulateMultipleQubits } from './simulator';
import { LABEL_WIDTH, GATE_OFFSET, COLUMN_WIDTH, MAX_COLUMNS } from '../utils/constants';
import { parsePiInput } from '../utils/piMath';
import { UNITARY_GATE_IDS, GATE_REGISTRY } from '../quantum/gates';

// UI-only: tracks controls placed in a column before any unitary op exists there
export const pendingControls = writable<Map<number, number[]>>(new Map());

// UI-only: tracks anti-controls placed in a column before any unitary op exists there
export const pendingAntiControls = writable<Map<number, number[]>>(new Map());

/*──────────────────────── simulation ────────────────────*/

export function triggerSimulation(ir: CircuitIR) {
    simulationResult.set(simulateMultipleQubits(ir));
}

/*──────────────────────── helpers ───────────────────────*/

function findNextAvailableColumn(ir: CircuitIR, qubit: number): number {
    const cols = ir.operations
        .filter(op => 'targets' in op && (op.targets as number[]).includes(qubit))
        .map(op => op.column);
    return cols.length ? Math.max(...cols) + 1 : 0;
}

function canonicalGate(gateType: string): string {
    return gateType.toLowerCase();
}

function isCellOccupied(ir: CircuitIR, col: number, qubit: number, excludeId?: string): boolean {
    return ir.operations.some(op =>
        op.column === col &&
        'targets' in op &&
        (op.targets as number[]).includes(qubit) &&
        (excludeId ? op.id !== excludeId : true)
    );
}

// Unions pending controls/anti-controls for a column with any already present
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
            (op as UnitaryOperation).controls.forEach(c => controls.add(c));
            (op as UnitaryOperation).antiControls.forEach(c => antiControls.add(c));
        }
    }
    return { controls: [...controls], antiControls: [...antiControls] };
}

// Removes any pending controls/anti-controls for a column once they've been
// consumed by a newly inserted operation.
function consumePendingControls(col: number, controls: number[], antiControls: number[]) {
    if (controls.length > 0) {
        pendingControls.update(map => { const next = new Map(map); next.delete(col); return next; });
    }
    if (antiControls.length > 0) {
        pendingAntiControls.update(map => { const next = new Map(map); next.delete(col); return next; });
    }
}

// Shared RX/RY/RZ drop handler — prompts for the angle and inserts the rotation gate.
function dropParametricGate(
    gate: 'rx' | 'ry' | 'rz',
    col: number,
    qubit: number,
    ir: CircuitIR,
    pending: Map<number, number[]>,
    antiPending: Map<number, number[]>
) {
    const occupied = isCellOccupied(ir, col, qubit);
    if (occupied) { console.warn(`Cell (${col}, q=${qubit}) is occupied.`); return; }

    const label = GATE_REGISTRY[gate].label;
    const angle = parsePiInput(prompt(`Enter ${label} angle (e.g. pi/2, pi/4, 3pi/4):`, 'pi/2') ?? '') ?? 0;

    const { controls, antiControls } = collectControlsInColumn(ir, col, pending, antiPending);

    const unitaryOp: UnitaryOperation = {
        id: crypto.randomUUID(),
        kind: 'unitary',
        gate,
        column: col,
        targets: [qubit],
        controls,
        antiControls,
        params: [angle],
    };
    insertOperation(unitaryOp);
    consumePendingControls(col, pending.get(col) ?? [], antiPending.get(col) ?? []);
    triggerSimulation(get(circuitIR));
}

// Shared CONTROL/ANTI_CONTROL drop handler — attaches to existing ops in the
// column, or parks the qubit in the pending map if no op exists yet.
function applyControlToColumn(
    field: 'controls' | 'antiControls',
    store: typeof pendingControls,
    col: number,
    qubit: number,
    ir: CircuitIR
) {
    const existingOps = ir.operations.filter(
        op => op.kind === 'unitary' && op.column === col
    ) as UnitaryOperation[];

    if (existingOps.length > 0) {
        for (const existingOp of existingOps) {
            if (!existingOp[field].includes(qubit)) {
                updateOperation(existingOp.id, op => ({
                    ...op,
                    [field]: [...(op as UnitaryOperation)[field], qubit]
                } as CircuitOperation));
            }
        }
    } else {
        store.update(map => {
            const next = new Map(map);
            const existing = next.get(col) ?? [];
            if (!existing.includes(qubit)) next.set(col, [...existing, qubit]);
            return next;
        });
    }
    triggerSimulation(get(circuitIR));
}

/*──────────────────────── drag helpers ──────────────────*/

let touchData: GateData | null = null;
let ghostElement: HTMLElement | null = null;

export function handleGateDragStart(e: DragEvent, id: string, gateType?: string, qubit?: number) {
    const isCopy = e.ctrlKey || e.metaKey;
    const dragData: GateData = { source: 'wire', gateId: id, isCopy, gateType, qubit };
    e.dataTransfer?.setData('application/json', JSON.stringify(dragData));
    isDragging.set(true);

    document.querySelectorAll('.gate.copying').forEach(el => el.classList.remove('copying'));
    if (isCopy) {
        const gateEl = document.querySelector(`[data-gate-id="${id}"]`);
        if (gateEl) gateEl.classList.add('copying');
    }
}

export function handleDragOver(e: DragEvent) {
    e.preventDefault();
}

/*──────────────────────── touch drag ────────────────────*/

export function handleTouchStart(event: TouchEvent, gateData: GateData) {
    event.preventDefault();
    touchData = gateData;

    ghostElement = document.createElement('div');
    ghostElement.style.pointerEvents = 'none';
    ghostElement.textContent = gateData.gateType || '';
    ghostElement.className = 'ghost-gate';
    ghostElement.style.cssText += 'position:fixed;z-index:1000;padding:8px 16px;border-radius:6px;background:#7e22ce;color:white;border:solid #3b0764';
    document.body.appendChild(ghostElement);

    const touch = event.touches[0];
    ghostElement.style.left = `${touch.clientX - 50}px`;
    ghostElement.style.top = `${touch.clientY - 50}px`;
}

export function handleTouchMove(event: TouchEvent) {
    event.preventDefault();
    if (ghostElement) {
        const touch = event.touches[0];
        ghostElement.style.left = `${touch.clientX - 40}px`;
        ghostElement.style.top = `${touch.clientY - 40}px`;
    }
}

export function handleTouchEnd(event: TouchEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDragging.set(false);

    if (!touchData) {
        ghostElement?.remove();
        ghostElement = null;
        return;
    }

    if (ghostElement) ghostElement.style.display = 'none';
    const touch = event.changedTouches[0];
    const elementUnderFinger = document.elementFromPoint(touch.clientX, touch.clientY);
    if (ghostElement) ghostElement.style.display = '';

    const wireContainer = elementUnderFinger?.closest('.wire-container');
    if (wireContainer) {
        const qubit = parseInt(wireContainer.getAttribute('data-qubit') ?? '0', 10);
        const wireRect = wireContainer.getBoundingClientRect();
        let col = Math.floor((touch.clientX - wireRect.left - GATE_OFFSET) / COLUMN_WIDTH);
        col = Math.max(0, Math.min(col, MAX_COLUMNS - 1));

        const syntheticEvent = {
            preventDefault: () => { },
            dataTransfer: { getData: () => JSON.stringify(touchData) }
        } as unknown as DragEvent;
        handleDrop(syntheticEvent, col, qubit);
    } else {
        const palette = elementUnderFinger?.closest('[aria-label="Quantum Circuit Gate Palette"]');
        if (palette && touchData.source === 'wire' && touchData.gateId) {
            removeGate(touchData.gateId);
        }
    }

    ghostElement?.remove();
    ghostElement = null;
    touchData = null;
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

    /*─── Ghost wire drop: expand qubit count ───*/
    if (qubit === ir.registers.q && ir.registers.q < 8) {
        setNumQubitsIR(ir.registers.q + 1);
        const freshIR = get(circuitIR);

        if (parsed.source === 'palette' && parsed.gateType) {
            _dropPaletteGate(parsed.gateType, col, qubit, freshIR, pending, antiPending);
        } else if (parsed.source === 'wire' && parsed.gateId) {
            updateOperation(parsed.gateId, op => ({ ...op, column: col, targets: [qubit] } as CircuitOperation));
            triggerSimulation(get(circuitIR));
        }
        return;
    }

    /*─── Move / copy existing gate ───*/
    if (parsed.source === 'wire' && parsed.gateId) {
        // Control/anti-control dot drag: move all sibling gates to the new column
        const isControlDrag = (parsed.gateType === 'CONTROL' || parsed.gateType === 'ANTI_CONTROL') && parsed.qubit !== undefined;
        if (isControlDrag) {
            const field = parsed.gateType === 'CONTROL' ? 'controls' : 'antiControls';
            const controlQubit = parsed.qubit as number;
            const sourceOp = ir.operations.find(op => op.id === parsed.gateId);
            if (!sourceOp) return;
            const sourceCol = sourceOp.column;
            const siblings = ir.operations.filter(
                op => op.kind === 'unitary' && op.column === sourceCol &&
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
                updateOperation(sib.id, op => ({ ...op, column: col } as CircuitOperation));
            }
            triggerSimulation(get(circuitIR));
            return;
        }

        // SWAP gate: both targets travel together — only the column changes
        const draggedOp = ir.operations.find(op => op.id === parsed.gateId);
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
                updateOperation(parsed.gateId, op => ({ ...op, column: col }));
            }
            triggerSimulation(get(circuitIR));
            return;
        }

        const occupied = isCellOccupied(ir, col, qubit, parsed.gateId);
        if (occupied) { console.warn(`Cell (${col}, q=${qubit}) is occupied.`); return; }

        // Collect pending + existing controls in destination column
        const { controls: allControls, antiControls: allAntiControls } =
            collectControlsInColumn(ir, col, pending, antiPending, parsed.gateId);

        const mergeControls = (op: CircuitOperation): CircuitOperation => {
            if (op.kind !== 'unitary') return { ...op, column: col, ...('targets' in op ? { targets: [qubit] } : {}) } as CircuitOperation;
            const base = op as UnitaryOperation;
            const merged = [...new Set([...base.controls, ...allControls])];
            const mergedAnti = [...new Set([...base.antiControls, ...allAntiControls])];
            return { ...base, column: col, targets: [qubit], controls: merged, antiControls: mergedAnti };
        };

        if (parsed.isCopy) {
            const original = ir.operations.find(op => op.id === parsed.gateId);
            if (!original) return;
            insertOperation({ ...mergeControls(original), id: crypto.randomUUID() } as CircuitOperation);
        } else {
            updateOperation(parsed.gateId, op => mergeControls(op));
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

    if (upperType === 'RX' || upperType === 'RY' || upperType === 'RZ') {
        dropParametricGate(upperType.toLowerCase() as 'rx' | 'ry' | 'rz', col, qubit, ir, pending, antiPending);
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
        if (occupied) { console.warn(`Cell (${col}, q=${qubit}) is occupied.`); return; }

        const measureOp: MeasureOperation = {
            id: crypto.randomUUID(),
            kind: 'measure',
            gate: 'measure',
            column: col,
            targets: [qubit],
            classicalTargets: [qubit],
        };
        insertOperation(measureOp);
        triggerSimulation(get(circuitIR));
        return;
    }

    if (upperType === 'SWAP') {
        const occupied = isCellOccupied(ir, col, qubit);
        if (occupied) { console.warn(`Cell (${col}, q=${qubit}) is occupied.`); return; }

        const secondQubitStr = prompt(
            `Enter the second qubit index to SWAP with (0–${ir.registers.q - 1}):`,
            String(qubit + 1 < ir.registers.q ? qubit + 1 : qubit - 1)
        );
        if (secondQubitStr === null) return;
        const secondQubit = parseInt(secondQubitStr, 10);

        if (isNaN(secondQubit) || secondQubit < 0 || secondQubit >= ir.registers.q || secondQubit === qubit) {
            console.warn('Invalid second qubit for SWAP.'); return;
        }
        if (isCellOccupied(ir, col, secondQubit)) {
            console.warn(`Cell (${col}, q=${secondQubit}) is occupied.`); return;
        }

        const unitaryOp: UnitaryOperation = {
            id: crypto.randomUUID(),
            kind: 'unitary',
            gate: 'swap',
            column: col,
            targets: [qubit, secondQubit],
            controls: [],
            antiControls: [],
            params: [],
        };
        insertOperation(unitaryOp);
        triggerSimulation(get(circuitIR));
        return;
    }

    // Standard unitary gate
    const occupied = isCellOccupied(ir, col, qubit);
    if (occupied) { console.warn(`Cell (${col}, q=${qubit}) is occupied.`); return; }

    const { controls, antiControls } = collectControlsInColumn(ir, col, pending, antiPending);

    const unitaryOp: UnitaryOperation = {
        id: crypto.randomUUID(),
        kind: 'unitary',
        gate: canonicalGate(gateType) as UnitaryOperation['gate'],
        column: col,
        targets: [qubit],
        controls,
        antiControls,
        params: [],
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
    const valid = [...UNITARY_GATE_IDS.map((g) => g.toUpperCase()), 'CONTROL', 'ANTI_CONTROL', 'MEASURE'];

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
            const sourceOp = ir.operations.find(op => op.id === data.gateId);
            if (!sourceOp) return;
            const col = sourceOp.column;
            const qubitToRemove = data.qubit;
            const field = data.gateType === 'CONTROL' ? 'controls' : 'antiControls';
            const siblings = ir.operations.filter(
                op => op.kind === 'unitary' && op.column === col &&
                    (op as UnitaryOperation)[field].includes(qubitToRemove)
            );
            for (const sib of siblings) {
                updateOperation(sib.id, op => ({
                    ...op,
                    [field]: (op as UnitaryOperation)[field].filter((c: number) => c !== qubitToRemove)
                } as CircuitOperation));
            }
            triggerSimulation(get(circuitIR));
        } else {
            removeGate(data.gateId);
        }
    }
}
