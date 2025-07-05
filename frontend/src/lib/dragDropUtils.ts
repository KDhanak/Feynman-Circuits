import { circuit, SimulationResults, type CircuitState, type GateType, type GateData, type GateInstance, } from './stores'
import { simulateMultipleQubits, simulateSingleQubit } from '$lib/simulator';

let touchData: GateData | null = null;
let ghostElement: HTMLElement | null = null;

export function handleGateDragStart(event: DragEvent, gateId: string) {
    const dragData: GateData = { source: 'wire', gateId };
    event.dataTransfer?.setData('application/json', JSON.stringify(dragData));
}

export function handleDragOver(event: DragEvent) {
    event.preventDefault(); // Needed to allow drop
}

export function handleTouchStart(event: TouchEvent, gateData: GateData) {
    event.preventDefault();

    touchData = gateData;
    // Create ghost element
    const target = event.currentTarget as HTMLElement;
    ghostElement = document.createElement('div');
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
    const wireContainer = elementUnderFinger?.closest('.wire-container');
    if (wireContainer) {

        // Define constants used in Wire.svelte for column calculation
        const LABEL_WIDTH = 80;
        const GATE_OFFSET = LABEL_WIDTH + 44;
        const COLUMN_WIDTH = 58;
        const MAX_COLUMNS = 29; // Ensure this matches Wire.svelte

        // Calculate columnIndex based on touch X position relative to wire container
        const wireRect = wireContainer.getBoundingClientRect();
        const touchXRelativeToWire = touch.clientX - wireRect.left;
        let calculatedColumnIndex = Math.floor((touchXRelativeToWire - GATE_OFFSET) / COLUMN_WIDTH);

        // Clamp columnIndex to valid range
        calculatedColumnIndex = Math.max(0, Math.min(calculatedColumnIndex, MAX_COLUMNS - 1));

        const qubit = 0; // Assuming single qubit for now, or fetch from wire-container data-qubit-index if multi-qubit

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


function triggerSimulation(circuitState: CircuitState) {
    const results = circuitState.numQubits === 1 ? simulateSingleQubit(circuitState) : simulateMultipleQubits(circuitState);
    SimulationResults.set(results);
}

export function findNextAvailableColumn(currentCircuitState: CircuitState, qubitIndex: number): number {
    const occupiedColumns = currentCircuitState.gates
        .filter(g => g.qubit === qubitIndex)
        .map(g => g.columnIndex);

    return occupiedColumns.length > 0 ? Math.max(...occupiedColumns) + 1 : 0;
}

export function handleDrop(event: DragEvent, columnIndex: number, qubit: number) {
    event.preventDefault();
    const gateData = event.dataTransfer?.getData('application/json');
    if (!gateData) return;

    let parsed: GateData;
    try {
        parsed = JSON.parse(gateData);
    } catch (error) {
        console.error('Failed to parse drag data in handleDrop:', error);
        return;
    }

    circuit.update((current) => {

        // 🎯 Case 1: Move existing gate
        if (parsed.source === 'wire' && parsed.gateId) {
            const existingGate = current.gates.find(g => g.id === parsed.gateId);
            if (!existingGate) return current;

            const isOccupied = current.gates.some(
                g => g.columnIndex === columnIndex && g.qubit === qubit && g.id !== parsed.gateId
            );
            if (isOccupied) {
                console.warn(`Column ${columnIndex} on qubit ${qubit} is already occupied`);
                return current;
            }

            const updatedGates = current.gates.map(g => {
                // Update the moved gate
                if (g.id === parsed.gateId) {
                    const movedGate = { ...g, columnIndex, qubit };

                    // 🧠 Try relinking if CONTROL
                    if (movedGate.gateType === 'CONTROL') {
                        const xGate = current.gates.find(other =>
                            other.columnIndex === columnIndex &&
                            other.gateType === 'X' &&
                            other.qubit !== movedGate.qubit
                        );
                        movedGate.targetQubit = xGate ? xGate.qubit : undefined;
                    }

                    return movedGate;
                }

                // Unlink any CONTROL if its target X gate moved away
                if (
                    g.gateType === 'CONTROL' &&
                    g.targetQubit === existingGate.qubit &&
                    existingGate.gateType === 'X' &&
                    (g.columnIndex !== columnIndex || existingGate.qubit !== qubit)
                ) {
                    return { ...g, targetQubit: undefined };
                }

                // Relink CONTROL to X gate if X is moved to its column
                if (
                    g.gateType === 'CONTROL' &&
                    g.columnIndex === columnIndex &&
                    g.targetQubit === undefined &&
                    existingGate.gateType === 'X' &&
                    g.qubit !== qubit
                ) {
                    return { ...g, targetQubit: qubit };
                }

                return g;
            });

            const updatedCircuit = { ...current, gates: updatedGates };
            triggerSimulation(updatedCircuit); // Trigger simulation to update UI
            return updatedCircuit;
        }

        // 🎯 Case 2: Drop from palette
        if (parsed.source === 'palette' && parsed.gateType) {
            const assignedQubit = current.numQubits === 1 ? 0 : qubit;
            const isOccupied = current.gates.some(g => g.qubit === assignedQubit && g.columnIndex === columnIndex);
            if (isOccupied) {
                console.warn(`Column ${columnIndex} on qubit ${qubit} is already occupied`);
                return current;
            }

            let newGate: GateInstance = {
                id: crypto.randomUUID(),
                gateType: parsed.gateType as GateType,
                qubit: assignedQubit,
                columnIndex,
            };

            let updatedGates = [...current.gates];

            if (parsed.gateType === 'CONTROL') {
                const xGate = current.gates.find(g =>
                    g.columnIndex === columnIndex &&
                    g.gateType === 'X' &&
                    g.qubit !== assignedQubit
                );
                if (xGate) {
                    newGate.targetQubit = xGate.qubit;
                }
            }

            if (parsed.gateType === 'X') {
                const controlIndex = current.gates.findIndex(g =>
                    g.columnIndex === columnIndex &&
                    g.gateType === 'CONTROL' &&
                    g.qubit !== assignedQubit &&
                    g.targetQubit === undefined
                );

                if (controlIndex !== -1) {
                    const updatedControl = {
                        ...current.gates[controlIndex],
                        targetQubit: assignedQubit,
                    };
                    updatedGates[controlIndex] = updatedControl;
                }
            }

            updatedGates.push(newGate);
            const updatedCircuit = { ...current, gates: updatedGates };
            triggerSimulation(updatedCircuit); // Trigger simulation to update UI
            return updatedCircuit;
        }

        return current;
    });
}


export function removeGate(gateId: string | undefined) {
    if (!gateId) return;

    circuit.update((current) => {
        const gateToRemove = current.gates.find(g => g.id === gateId);
        if (!gateToRemove) return current;

        let updatedGates = current.gates.filter(g => g.id !== gateId);

        if (gateToRemove.gateType === 'X') {
            updatedGates = updatedGates.map(g => {
                if (
                    g.gateType === 'CONTROL' &&
                    g.columnIndex === gateToRemove.columnIndex &&
                    g.targetQubit === gateToRemove.qubit
                ) {
                    return { ...g, targetQubit: undefined };
                }
                return g;
            });
        }

        const newCircuit = { ...current, gates: updatedGates };

        triggerSimulation(newCircuit);

        return newCircuit;
    })
}

export function handlePaletteDrop(event: DragEvent) {
    event.preventDefault();
    const gateData = event.dataTransfer?.getData('application/json');
    if (!gateData) return;

    let parsed: GateData;
    try {
        parsed = JSON.parse(gateData);
    } catch (error) {
        console.error('Failed to parse drag data in handlePaletteDrop:', error);
        return;
    }

    if (parsed.source === 'wire' && parsed.gateId) {
        removeGate(parsed.gateId);
    }
}


export function handleDoubleClick(gateData: GateData) {
    const validGates: GateType[] = ['X', 'Y', 'Z', 'H', 'S', 'T', 'CONTROL'];

    circuit.update(current => {
        let updatedCircuit: CircuitState = current;

        if (gateData.source === 'palette' && gateData.gateType) {
            if (current.numQubits > 1) {
                return current;
            };

            const gateType = gateData.gateType as GateType;
            if (!validGates.includes(gateType)) {
                console.error(`Invalid Gate Type: ${gateType}`);
                return current;
            };

            if (gateType === 'CONTROL' && current.numQubits < 2) {
                console.error('Control Gate requires at least 2 qubits');
                return current;
            };

            const assignedQubit = current.numQubits === 1 ? 0 : 0;

            const nextColumn = findNextAvailableColumn(current, assignedQubit);

            const newGate: GateInstance = {
                id: crypto.randomUUID(),
                gateType,
                columnIndex: nextColumn,
                qubit: assignedQubit,
                ...(gateType === 'CONTROL' ? { targetQubit: undefined } : {}),
            };

            updatedCircuit = {
                ...current,
                gates: [...current.gates, newGate],
            };
        } else if (gateData.source === 'wire' && gateData.gateId) {
            updatedCircuit = {
                ...current,
                gates: current.gates.filter(g => g.id !== gateData.gateId),
            };
        }

        triggerSimulation(updatedCircuit);
        return updatedCircuit;
    })
}
