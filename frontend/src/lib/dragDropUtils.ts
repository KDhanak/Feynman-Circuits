import {
    circuit,
    SimulationResults,
    isDragging,
    type CircuitState,
    type GateType,
    type GateData,
    type GateInstance,
} from "./stores";
import {
    simulateMultipleQubits,
} from "$lib/simulator";

/*──────────────────────── helpers ───────────────────────*/

export function triggerSimulation(cs: CircuitState) {
    const result = simulateMultipleQubits(cs);
    SimulationResults.set(result);
}

function findNextAvailableColumn(cs: CircuitState, q: number) {
    const cols = cs.gates.filter(g => g.qubit === q).map(g => g.columnIndex);
    return cols.length ? Math.max(...cols) + 1 : 0;
}

function isCopyModifier(e: DragEvent | TouchEvent): boolean {
    if (e instanceof DragEvent) {
        return e.ctrlKey || e.metaKey;
    }
    return false;
}

/** Recompute every CONTROL→X pairing for a consistent circuit */
function relinkControls(gates: GateInstance[]): GateInstance[] {
    return gates.map(g => {
        if (g.gateType !== "CONTROL") return g;

        const targets = gates.filter(
            o => o.gateType !== "CONTROL" &&
                o.columnIndex === g.columnIndex &&
                o.qubit !== g.qubit
        );

        // Separate targets above and below the control
        const below = targets.filter(t => t.qubit > g.qubit);
        const above = targets.filter(t => t.qubit < g.qubit);

        // Prefer targets in the direction we have them
        // If no targets below, try above
        const targetList = [...below, ...above];

        return {
            ...g,
            targetQubits: targetList.length > 0 ? targetList.map(t => t.qubit) : undefined,
            targetQubit: targetList.length > 0 ? targetList[0].qubit : undefined,
        } as GateInstance;
    });
}

/*──────────────────────── drag helpers ──────────────────*/

let touchData: GateData | null = null;
let ghostElement: HTMLElement | null = null;

export function handleGateDragStart(e: DragEvent, id: string) {
    const isCopy = isCopyModifier(e);

    const dragData: GateData = {
        source: "wire",
        gateId: id,
        isCopy
    };

    e.dataTransfer?.setData(
        "application/json",
        JSON.stringify(dragData)
    );
    isDragging.set(true);
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
    isDragging.set(false);
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
    isDragging.set(false);

    const raw = e.dataTransfer?.getData("application/json");
    if (!raw) return;

    const parsed = JSON.parse(raw) as GateData;

    circuit.update(current => {
        /*─── 0. Handle ghost qubit drop (expand qubits) ───*/
        if (qubit === current.numQubits && current.numQubits < 8) {
            // Dropping on the ghost wire: expand the circuit
            if (parsed.source === "palette" && parsed.gateType) {
                const newQubit = current.numQubits;
                const newNumQubits = current.numQubits + 1;

                const newGate: GateInstance = {
                    id: crypto.randomUUID(),
                    gateType: parsed.gateType as GateType,
                    qubit: newQubit,
                    columnIndex: col,
                };

                const relinked = relinkControls([...current.gates, newGate]);
                const updated = {
                    ...current,
                    numQubits: newNumQubits,
                    gates: relinked,
                    qubitLabels: Array.from({ length: newNumQubits }, (_, i) => `Qubit ${i}`)
                };
                triggerSimulation(updated);
                return updated;
            } else if (parsed.source === "wire" && parsed.gateId) {
                // Moving or Copying a gate to the ghost qubit also expands
                const moving = current.gates.find(g => g.id === parsed.gateId);
                if (!moving) return current;

                const newQubit = current.numQubits;
                const newNumQubits = current.numQubits + 1;

                const afterMove = current.gates.map(g =>
                    g.id === moving.id ? { ...g, columnIndex: col, qubit: newQubit } : g
                );

                const relinked = relinkControls(afterMove);
                const updated = {
                    ...current,
                    numQubits: newNumQubits,
                    gates: relinked,
                    qubitLabels: Array.from({ length: newNumQubits }, (_, i) => `Qubit ${i}`)
                };
                triggerSimulation(updated);
                return updated;
            }
            return current;
        }

        /*─── 1. MOVE or COPY an existing gate ───*/
        if (parsed.source === "wire" && parsed.gateId) {
            const original = current.gates.find(g => g.id === parsed.gateId);
            if (!original) return current;

            const isCopy = parsed.isCopy ?? false;

            // Check if target slot is free
            if (current.gates.some(g =>
                g.columnIndex === col &&
                g.qubit === qubit &&
                g.id !== original.id
            )) {
                console.warn(`Cell (${col}, q=${qubit}) is occupied.`);
                return current;
            }

            let newGates = [...current.gates];

            if (isCopy) {
                // Duplicate: create new gate with same type but new ID
                const duplicate: GateInstance = {
                    ...original,
                    id: crypto.randomUUID(),           // NEW ID
                    columnIndex: col,
                    qubit: qubit
                };
                newGates.push(duplicate);
            } else {
                // Normal move
                newGates = newGates.map(g =>
                    g.id === original.id
                        ? { ...g, columnIndex: col, qubit }
                        : g
                );
            }

            const relinked = relinkControls(newGates);
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
        isDragging.set(false);
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
    const valid: GateType[] = ["X", "Y", "Z", "H", "S", "T", "CONTROL", "MEASURE"];

    circuit.update(current => {
        let next = current;

        if (data.source === "palette" && data.gateType) {
            const gt = data.gateType as GateType;
            if (!valid.includes(gt)) return current;

            // For single qubit → always use qubit 0
            // For multi qubit → use the first qubit (or improve later with click target)
            const q = current.numQubits === 1 ? 0 : 0;   // You can enhance this later

            const col = findNextAvailableColumn(current, q);

            const g: GateInstance = {
                id: crypto.randomUUID(),
                gateType: gt,
                qubit: q,
                columnIndex: col,
            };

            next = { ...current, gates: [...current.gates, g] };
        } 
        else if (data.source === "wire" && data.gateId) {
            next = { ...current, gates: current.gates.filter(g => g.id !== data.gateId) };
        }

        const relinked = relinkControls(next.gates);
        const updated = { ...next, gates: relinked };
        triggerSimulation(updated);
        return updated;
    });
}
