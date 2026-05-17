import type { CircuitIR, UnitaryOperation, MeasureOperation, CircuitOperation, GateData } from './IR/schema';
import { writable, get } from 'svelte/store';
import { isDragging } from './stores';
import { circuitIR, simulationResult } from './IR/stores';
import { insertOperation, updateOperation, removeOperation, setNumQubitsIR } from './IR/operations';
import { simulateMultipleQubits } from './simulator';

// UI-only: tracks controls placed in a column before any unitary op exists there
export const pendingControls = writable<Map<number, number[]>>(new Map());

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

/*──────────────────────── drag helpers ──────────────────*/

let touchData: GateData | null = null;
let ghostElement: HTMLElement | null = null;

export function handleGateDragStart(e: DragEvent, id: string) {
    const isCopy = e.ctrlKey || e.metaKey;
    const dragData: GateData = { source: 'wire', gateId: id, isCopy };
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

    const LABEL_WIDTH = 80;
    const GATE_OFFSET = LABEL_WIDTH + 44;
    const COLUMN_WIDTH = 58;
    const MAX_COLUMNS = 29;

    const wireContainer = elementUnderFinger?.closest('.wire-container-upper');
    if (wireContainer) {
        const qubit = parseInt(wireContainer.getAttribute('data-qubit') ?? '0', 10);
        const wireRect = wireContainer.getBoundingClientRect();
        let col = Math.floor((touch.clientX - wireRect.left - GATE_OFFSET) / COLUMN_WIDTH);
        col = Math.max(0, Math.min(col, MAX_COLUMNS - 1));

        const syntheticEvent = {
            preventDefault: () => {},
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

    /*─── Ghost wire drop: expand qubit count ───*/
    if (qubit === ir.registers.q && ir.registers.q < 8) {
        setNumQubitsIR(ir.registers.q + 1);
        const freshIR = get(circuitIR);

        if (parsed.source === 'palette' && parsed.gateType) {
            _dropPaletteGate(parsed.gateType, col, qubit, freshIR, pending);
        } else if (parsed.source === 'wire' && parsed.gateId) {
            updateOperation(parsed.gateId, op => ({ ...op, column: col, targets: [qubit] } as CircuitOperation));
            triggerSimulation(get(circuitIR));
        }
        return;
    }

    /*─── Move / copy existing gate ───*/
    if (parsed.source === 'wire' && parsed.gateId) {
        const occupied = ir.operations.some(op =>
            op.column === col &&
            'targets' in op &&
            (op.targets as number[]).includes(qubit) &&
            op.id !== parsed.gateId
        );
        if (occupied) { console.warn(`Cell (${col}, q=${qubit}) is occupied.`); return; }

        if (parsed.isCopy) {
            const original = ir.operations.find(op => op.id === parsed.gateId);
            if (!original) return;
            insertOperation({ ...original, id: crypto.randomUUID(), column: col, ...('targets' in original ? { targets: [qubit] } : {}) } as CircuitOperation);
        } else {
            updateOperation(parsed.gateId, op => ({ ...op, column: col, ...('targets' in op ? { targets: [qubit] } : {}) } as CircuitOperation));
        }
        triggerSimulation(get(circuitIR));
        return;
    }

    /*─── Drop from palette ───*/
    if (parsed.source === 'palette' && parsed.gateType) {
        _dropPaletteGate(parsed.gateType, col, qubit, ir, pending);
    }
}

function _dropPaletteGate(
    gateType: string,
    col: number,
    qubit: number,
    ir: CircuitIR,
    pending: Map<number, number[]>
) {
    const upperType = gateType.toUpperCase();

    if (upperType === 'CONTROL') {
        // Find all unitary ops in this column
        const existingOps = ir.operations.filter(
            op => op.kind === 'unitary' && op.column === col
        ) as UnitaryOperation[];

        if (existingOps.length > 0) {
            // Attach control to all unitary ops in this column
            for (const existingOp of existingOps) {
                if (!existingOp.controls.includes(qubit)) {
                    updateOperation(existingOp.id, op => ({
                        ...op,
                        controls: [...(op as UnitaryOperation).controls, qubit]
                    } as CircuitOperation));
                }
            }
        } else {
            // No unitary op yet — park in pendingControls
            pendingControls.update(map => {
                const next = new Map(map);
                const existing = next.get(col) ?? [];
                if (!existing.includes(qubit)) next.set(col, [...existing, qubit]);
                return next;
            });
        }
        triggerSimulation(get(circuitIR));
        return;
    }

    if (upperType === 'MEASURE') {
        const occupied = ir.operations.some(op => op.column === col && 'targets' in op && (op.targets as number[]).includes(qubit));
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

    // Standard unitary gate
    const occupied = ir.operations.some(op => op.column === col && 'targets' in op && (op.targets as number[]).includes(qubit));
    if (occupied) { console.warn(`Cell (${col}, q=${qubit}) is occupied.`); return; }

    const pendingInColumn = pending.get(col) ?? [];

    // Also collect controls from other operations in this column
    const existingControls = new Set<number>();
    for (const op of ir.operations) {
        if (op.kind === 'unitary' && op.column === col) {
            (op as UnitaryOperation).controls.forEach(c => existingControls.add(c));
        }
    }

    const allControls = [...new Set([...pendingInColumn, ...existingControls])];

    const unitaryOp: UnitaryOperation = {
        id: crypto.randomUUID(),
        kind: 'unitary',
        gate: canonicalGate(gateType) as UnitaryOperation['gate'],
        column: col,
        targets: [qubit],
        controls: allControls,
        params: [],
    };
    insertOperation(unitaryOp);

    // Clear consumed pending controls for this column
    if (pendingInColumn.length > 0) {
        pendingControls.update(map => { const next = new Map(map); next.delete(col); return next; });
    }

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
    const valid = ['X', 'Y', 'Z', 'H', 'S', 'T', 'CONTROL', 'MEASURE'];

    if (data.source === 'palette' && data.gateType) {
        if (!valid.includes(data.gateType.toUpperCase())) return;
        const ir = get(circuitIR);
        const col = findNextAvailableColumn(ir, 0);
        const pending = get(pendingControls);
        _dropPaletteGate(data.gateType, col, 0, ir, pending);
    } else if (data.source === 'wire' && data.gateId) {
        removeGate(data.gateId);
    }
}
