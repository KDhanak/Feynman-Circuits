// dragDropUtils.ts  –  cleaned version  ❱❱❱

import {
    circuit,
    SimulationResults,
    type CircuitState,
    type GateType,
    type GateData,
    type GateInstance,
    type MatrixGateType,
} from "./stores";
import {
    simulateMultipleQubits,
    simulateSingleQubit,
} from "$lib/simulator";
import { get } from "svelte/store";

/*──────────────────────── helpers ───────────────────────*/

/** schedule a re-simulation after any edit */
function triggerSimulation(cs: CircuitState) {
    const r =
        cs.numQubits === 1 ? simulateSingleQubit(cs) : simulateMultipleQubits(cs);
    SimulationResults.set(r);
}

/**
 * Find the left-most free column for a given wire.
 * A column is free if **no gate touches that wire** in that column.
 */
function findNextAvailableColumn(cs: CircuitState, wire: number): number {
    const occupied = cs.gates
        .filter(g => g.qubits.includes(wire))
        .map(g => g.columnIndex);

    return occupied.length ? Math.max(...occupied) + 1 : 0;
}

/*──────────────────────── drag helpers ──────────────────*/

let touchData: GateData | null = null;
let ghostElement: HTMLElement | null = null;

export function handleGateDragStart(e: DragEvent, id: string) {
    e.dataTransfer?.setData(
        "application/json",
        JSON.stringify({ source: "wire", gateId: id } satisfies GateData)
    );
}
export function handleDragOver(e: DragEvent) {
    e.preventDefault();
}

/*──────────────────────── drag with touch ───────────────────────*/

export function handleTouchStart(event: TouchEvent, gateData: GateData) {
    event.preventDefault();

    touchData = gateData;
    // Create ghost element
    const target = event.currentTarget as HTMLElement;
    ghostElement = document.createElement('div');
    ghostElement.style.pointerEvents = 'none';
    ghostElement.textContent = gateData.gateType || '';
    ghostElement.className = 'ghost-gate';
    ghostElement.style.position = 'fixed';
    ghostElement.style.zIndex = '1000';
    ghostElement.style.padding = '8px 16px';
    ghostElement.style.borderRadius = '6px';
    ghostElement.style.backgroundColor = '#7e22ce';
    ghostElement.style.color = 'white';
    ghostElement.style.border = 'solid #3b0764'
    document.body.appendChild(ghostElement);
    // Set initial position
    const touch = event.touches[0];
    ghostElement.style.left = `${touch.clientX - 50}px`;
    ghostElement.style.top = `${touch.clientY - 50}px`;
}

export function handleTouchMove(event: TouchEvent) {
    event.preventDefault();
    if (ghostElement) {
        const touch = event.touches[0];
        ghostElement.style.left = `${touch.clientX - 40}px`; // Offset for better visibility
        ghostElement.style.top = `${touch.clientY - 40}px`;
    }
}

export function handleTouchEnd(event: TouchEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!touchData) {
        console.warn('No touchData available in handleTouchEnd. Exiting.'); // DEBUG
        if (ghostElement) {
            ghostElement.remove();
            ghostElement = null;
        }
        return;
    }

    // Temporarily hide ghost element to find the element underneath the touch
    if (ghostElement) {
        ghostElement.style.display = 'none';
    }
    const touch = event.changedTouches[0];
    const elementUnderFinger = document.elementFromPoint(touch.clientX, touch.clientY);
    // Show ghost element again
    if (ghostElement) {
        ghostElement.style.display = '';
    }

    let droppedHandled = false;

    // Check if dropped on the wire container (primary touch drop target)
    const wireContainer = elementUnderFinger?.closest('.wire-container-upper');
    if (wireContainer) {

        // Define constants used in Wire.svelte for column calculation
        const LABEL_WIDTH = 80;
        const GATE_OFFSET = LABEL_WIDTH + 44;
        const COLUMN_WIDTH = 58;
        const MAX_COLUMNS = 29; // Ensure this matches Wire.svelte

        const qubitAttr = wireContainer.getAttribute('data-qubit');
        const qubit = qubitAttr ? parseInt(qubitAttr, 10) : 0; // Default to 0 if not found

        // Calculate columnIndex based on touch X position relative to wire container
        const wireRect = wireContainer.getBoundingClientRect();
        const touchXRelativeToWire = touch.clientX - wireRect.left;
        let calculatedColumnIndex = Math.floor((touchXRelativeToWire - GATE_OFFSET) / COLUMN_WIDTH);

        // Clamp columnIndex to valid range
        calculatedColumnIndex = Math.max(0, Math.min(calculatedColumnIndex, MAX_COLUMNS - 1));

        const syntheticEvent = {
            preventDefault: () => { },
            dataTransfer: {
                getData: () => JSON.stringify(touchData),
            }
        } as unknown as DragEvent;
        handleDrop(syntheticEvent, calculatedColumnIndex, qubit);
        droppedHandled = true;

    } else {
        // Check if dropped back on the palette (for removing gates dragged from wire)
        const paletteElement = elementUnderFinger?.closest('[aria-label="Quantum Circuit Gate Palette"]');
        if (paletteElement) {
            if (touchData.source === 'wire' && touchData.gateId) { // Only remove if dragged from wire
                removeGate(touchData.gateId);
                droppedHandled = true;
            } else {
                droppedHandled = true; // Still handled, just no action
            }
        } else {
            console.log('Dropped on an invalid area. No action taken.'); // DEBUG
        }
    }

    // Clean up ghost element and touch data regardless of drop validity
    if (ghostElement) {
        ghostElement.remove();
        ghostElement = null;
    }
    touchData = null;
}

/*──────────────────────── drop logic ────────────────────*/

export function handleDrop(e: DragEvent, col: number, wire: number) {
    e.preventDefault();
    const raw = e.dataTransfer?.getData("application/json");
    if (!raw) return;

    const parsed = JSON.parse(raw) as GateData;

    circuit.update(current => {
        /*─── 1. MOVE an existing gate ───*/
        if (parsed.source === "wire" && parsed.gateId) {
            const moving = current.gates.find(g => g.id === parsed.gateId);
            if (!moving) return current;

            const occupied = current.gates.some(
                g => g.columnIndex === col && g.qubits.includes(wire) && g.id !== moving.id
            );

            if (occupied) {
                console.warn(`Cell (${col}, q=${wire}) is occupied.`);
                return current;
            }

            const afterMove = current.gates.map(g =>
                g.id === moving.id ? { ...g, columnIndex: col, qubits: [wire] } : g
            );

            const draft = {...current, gates: afterMove}
            const updated = mergeControlledGates(draft);
            triggerSimulation(updated);
            return updated;
        }

        /*─── 2. DROP from palette ───*/
        if (parsed.source === "palette" && parsed.gateType) {
            const wireForNewGate = current.numQubits === 1 ? 0 : wire;

            const occupied = current.gates.some(
                g => g.columnIndex === col && g.qubits.includes(wireForNewGate)
            );

            if (occupied) {
                console.warn(`Cell (${col}, q=${wireForNewGate}) is occupied.`);
                return current;
            }

            const newGate: GateInstance = {
                id: crypto.randomUUID(),
                gateType: parsed.gateType as GateType,
                qubits: [wireForNewGate],
                columnIndex: col,
            };

            const draft = {...current, gates: [...current.gates, newGate]};
            const updated = mergeControlledGates(draft);
            triggerSimulation(updated);
            return updated;
        }

        return current;
    });
}

/*──────────────── merge CONTROLLED stubs & base gates ───────────────*/

/**
 * Scan every column and, when exactly one 1-qubit gate and ≥1 CONTROLLED
 * stubs share that column, collapse them into a single GateInstance that
 * represents the multi-controlled-U gate the simulator expects.
 */

export function mergeControlledGates(cs: CircuitState): CircuitState {
    const byColumn = new Map<number, GateInstance[]>();
    cs.gates.forEach(g => {
        const arr = byColumn.get(g.columnIndex) ?? [];
        arr.push(g);
        byColumn.set(g.columnIndex, arr);
    });

    const merged: GateInstance[] = [];

    for (const [col, arr] of byColumn) {
        const plain1Q = arr.filter(
            g => g.gateType !== "CONTROLLED" && g.qubits.length === 1
        );
        const controls = arr.filter(g => g.gateType === "CONTROLLED");

        // Need exactly one base gate and at least one control
        if (plain1Q.length !== 1 || controls.length === 0) {
            merged.push(...arr);
            continue;
        }

        const base = plain1Q[0];
        const qubits = [...controls.map(c => c.qubits[0]), base.qubits[0]];
        const controlIdx = controls.map((_, i) => i);
        const targetIdx = [qubits.length - 1];

        merged.push({
            id: crypto.randomUUID(),
            gateType: "CONTROLLED",
            qubits,
            columnIndex: col,
            baseGate: base.gateType as MatrixGateType,
            controlQubits: controlIdx,
            targetQubits: targetIdx,
        });
    }

    return { ...cs, gates: merged };
}

/*──────────────────────── delete ────────────────────────*/

export function removeGate(id?: string) {
    if (!id) return;
    circuit.update(current => {
        const afterDelete = current.gates.filter(g => g.id !== id);

        const updated = { ...current, gates: afterDelete };
        triggerSimulation(updated);
        return updated;
    });
}

/*──────────────────────── palette drop ──────────────────*/

export function handlePaletteDrop(e: DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer?.getData("application/json");
    if (!raw) return;
    const parsed = JSON.parse(raw) as GateData;
    if (parsed.source === "wire" && parsed.gateId) removeGate(parsed.gateId);
}

/*──────────────────────── double-click ──────────────────*/

export function handleDoubleClick(data: GateData) {
    const valid: GateType[] = ["X", "Y", "Z", "H", "S", "T", "CONTROLLED"];
    circuit.update(current => {
        let next = current;

        if (data.source === "palette" && data.gateType) {
            if (current.numQubits > 1) return current;
            const gt = data.gateType as GateType;
            if (!valid.includes(gt)) return current;

            const q = 0;
            const col = findNextAvailableColumn(current, q);
            const g: GateInstance = {
                id: crypto.randomUUID(),
                gateType: gt,
                qubits: [q],
                columnIndex: col,
            };
            next = { ...current, gates: [...current.gates, g] };
        } else if (data.source === "wire" && data.gateId) {
            next = { ...current, gates: current.gates.filter(g => g.id !== data.gateId) };
        }

        triggerSimulation(next);
        return next;
    });
}
