import { circuit, SimulationResults, type CircuitState, type GateType, type GateData, isSingleQubitMode, universalNumQubits, type GateInstance, } from './stores'
import { simulateMultipleQubits, simulateSingleQubit } from '$lib/simulator';
import { get } from 'svelte/store';

export function handleGateDragStart(event: DragEvent, gateId: string) {
    const dragData: GateData = { source: 'wire', gateId };
    event.dataTransfer?.setData('application/json', JSON.stringify(dragData));
}

export function handleDragOver(event: DragEvent) {
    event.preventDefault(); // Needed to allow drop
}

function triggerSimulation(circuitState: CircuitState, isSingleMode: boolean) {
    const results = isSingleMode
        ? simulateSingleQubit(circuitState)
        : simulateMultipleQubits(circuitState);
    SimulationResults.set(results);
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

    const numQubits = get(universalNumQubits);
    const singleMode = get(isSingleQubitMode);

    circuit.update((current) => {
        const updatedNumQubits = singleMode ? 1 : numQubits;
        current = { ...current, numQubits: updatedNumQubits };

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
            triggerSimulation(updatedCircuit, singleMode); // Trigger simulation to update UI
            return updatedCircuit;
        }

        // 🎯 Case 2: Drop from palette
        if (parsed.source === 'palette' && parsed.gateType) {
            const isOccupied = current.gates.some(g => g.qubit === qubit && g.columnIndex === columnIndex);
            if (isOccupied) {
                console.warn(`Column ${columnIndex} on qubit ${qubit} is already occupied`);
                return current;
            }

            let newGate: GateInstance = {
                id: crypto.randomUUID(),
                gateType: parsed.gateType as GateType,
                qubit: singleMode ? 0 : qubit,
                columnIndex,
            };

            let updatedGates = [...current.gates];

            if (parsed.gateType === 'CONTROL') {
                const xGate = current.gates.find(g =>
                    g.columnIndex === columnIndex &&
                    g.gateType === 'X' &&
                    g.qubit !== qubit
                );
                if (xGate) {
                    newGate.targetQubit = xGate.qubit;
                }
            }

            if (parsed.gateType === 'X') {
                const controlIndex = current.gates.findIndex(g =>
                    g.columnIndex === columnIndex &&
                    g.gateType === 'CONTROL' &&
                    g.qubit !== qubit &&
                    g.targetQubit === undefined
                );

                if (controlIndex !== -1) {
                    const updatedControl = {
                        ...current.gates[controlIndex],
                        targetQubit: qubit
                    };
                    updatedGates[controlIndex] = updatedControl;
                }
            }

            updatedGates.push(newGate);
            const updatedCircuit = { ...current, gates: updatedGates };
            triggerSimulation(updatedCircuit, singleMode); // Trigger simulation to update UI
            return updatedCircuit;
        }

        return current;
    });
}


export function removeGate(gateId: string | undefined) {
    if (!gateId) return;

    let updatedCircuit: CircuitState;
    circuit.update((current) => {
        const newCircuit = {
            ...current,
            gates: current.gates.filter((gate) => gate.id !== gateId),
        };
        updatedCircuit = newCircuit;
        return newCircuit;
    });

    const singleMode = get(isSingleQubitMode);
    const results = singleMode ? simulateSingleQubit(updatedCircuit!) : simulateMultipleQubits(updatedCircuit!);
    SimulationResults.set(results);
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
    const singleMode = get(isSingleQubitMode);
    const numQubitsValue = get(universalNumQubits);

    if (gateData.source === 'palette' && gateData.gateType) {
        const gateType = gateData.gateType as GateType;
        if (!validGates.includes(gateType)) {
            console.error(`Invalid gate type: ${gateType}`);
            return;
        }

        if (gateType === 'CONTROL' && (singleMode || numQubitsValue < 2)) {
            console.error('Control gate requires at least 2 qubits');
            return;
        }

        circuit.update((current) => {
            const newCircuit: CircuitState = {
                ...current,
                gates: [
                    ...current.gates,
                    {
                        id: crypto.randomUUID(),
                        gateType: gateType,
                        columnIndex: 0, // Default column index for new gates
                        qubit: singleMode ? 0 : 0,
                        ...(gateType === 'CONTROL' ? { targetQubit: undefined } : {}),
                    },
                ],
            };
            return newCircuit;
        });
    } else if (gateData.source === 'wire') {
        const gateId = gateData.gateId
        removeGate(gateId);
    }

    const updatedCircuit = get(circuit);
    const results = singleMode ? simulateSingleQubit(updatedCircuit) : simulateMultipleQubits(updatedCircuit);;
    SimulationResults.set(results);
}
