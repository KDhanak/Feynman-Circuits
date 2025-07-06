// dragDropUtils.ts  –  cleaned version  ❱❱❱

import {
    circuit,
    SimulationResults,
    type CircuitState,
    type GateType,
    type GateData,
    type GateInstance,
} from "./stores";
import {
    simulateMultipleQubits,
    simulateSingleQubit,
} from "$lib/simulator";

/*──────────────────────── helpers ───────────────────────*/

function triggerSimulation(cs: CircuitState) {
    const r =
        cs.numQubits === 1 ? simulateSingleQubit(cs) : simulateMultipleQubits(cs);
    SimulationResults.set(r);
}

function findNextAvailableColumn(cs: CircuitState, q: number) {
    const cols = cs.gates.filter(g => g.qubit === q).map(g => g.columnIndex);
    return cols.length ? Math.max(...cols) + 1 : 0;
}

/** Recompute every CONTROL→X pairing for a consistent circuit */
function relinkControls(gates: GateInstance[]): GateInstance[] {
    return gates.map(g =>
        g.gateType === "CONTROL"
            ? {
                ...g,
                targetQubit: gates.find(
                    o =>
                        (o.gateType === "X" || "Y" || "Z" || "H" || "S" || "T") &&
                        o.columnIndex === g.columnIndex &&
                        o.qubit !== g.qubit
                )?.qubit,
            }
            : g
    );
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

export function handleDrop(e: DragEvent, col: number, qubit: number) {
    e.preventDefault();
    const raw = e.dataTransfer?.getData("application/json");
    if (!raw) return;

    const parsed = JSON.parse(raw) as GateData;

    circuit.update(current => {
        /*─── 1. MOVE an existing gate ───*/
        if (parsed.source === "wire" && parsed.gateId) {
            const moving = current.gates.find(g => g.id === parsed.gateId);
            if (!moving) return current;

            if (
                current.gates.some(
                    g => g.columnIndex === col && g.qubit === qubit && g.id !== moving.id
                )
            ) {
                console.warn(`Cell (${col}, q=${qubit}) is occupied.`);
                return current;
            }

            const afterMove = current.gates.map(g =>
                g.id === moving.id ? { ...g, columnIndex: col, qubit } : g
            );

            const relinked = relinkControls(afterMove);
            const updated = { ...current, gates: relinked };
            triggerSimulation(updated);
            return updated;
        }

        /*─── 2. DROP from palette ───*/
        if (parsed.source === "palette" && parsed.gateType) {
            const q = current.numQubits === 1 ? 0 : qubit;
            if (current.gates.some(g => g.qubit === q && g.columnIndex === col)) {
                console.warn(`Cell (${col}, q=${q}) is occupied.`);
                return current;
            }

            const newGate: GateInstance = {
                id: crypto.randomUUID(),
                gateType: parsed.gateType as GateType,
                qubit: q,
                columnIndex: col,
            };

            const relinked = relinkControls([...current.gates, newGate]);
            const updated = { ...current, gates: relinked };
            triggerSimulation(updated);
            return updated;
        }

        return current;
    });
}

/*──────────────────────── delete ────────────────────────*/

export function removeGate(id?: string) {
    if (!id) return;
    circuit.update(current => {
        const afterDelete = current.gates.filter(g => g.id !== id);
        const relinked = relinkControls(afterDelete);
        const updated = { ...current, gates: relinked };
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
    const valid: GateType[] = ["X", "Y", "Z", "H", "S", "T", "CONTROL"];
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
                qubit: q,
                columnIndex: col,
            };
            next = { ...current, gates: [...current.gates, g] };
        } else if (data.source === "wire" && data.gateId) {
            next = { ...current, gates: current.gates.filter(g => g.id !== data.gateId) };
        }

        const relinked = relinkControls(next.gates);
        const updated = { ...next, gates: relinked };
        triggerSimulation(updated);
        return updated;
    });
}
