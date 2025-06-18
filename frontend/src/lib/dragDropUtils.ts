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

//define the handleDrop function
export function handleDrop(event: DragEvent, columnIndex: number, qubit: number) {
    event.preventDefault();
    const gateData = event.dataTransfer?.getData('application/json');
    if (!gateData) return;

    let parsed: GateData;
    // Parse the drag data
    // If parsing fails, log the error and return
    // This is important to avoid breaking the app if the data format changes
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
        return { ...current, numQubits: updatedNumQubits }; // Sync numQubits
    });

    // Handle the drop based on the source of the drag data
    if (parsed.source === 'wire' && parsed.gateId) {
        circuit.update((current) => {
            const existingGate = current.gates.find(g => g.id === parsed.gateId);

            if (!existingGate) return current; // If gate not found, do nothing

            const isOccupied = current.gates.some(g => g.qubit === qubit && g.columnIndex === columnIndex);
            if (isOccupied) {
                console.warn(`Column ${columnIndex} on qubit ${qubit} is already occupied`);
                return current; // Do not move gate if the column is occupied
            };

            const updatedGates = current.gates.map(g =>
                g.id === parsed.gateId ? { ...g, columnIndex, qubit } : g
            );

            return { ...current, gates: updatedGates };
        });

        const updatedCircuit = get(circuit);
        const results = singleMode ? simulateSingleQubit(updatedCircuit) : simulateMultipleQubits(updatedCircuit);
        SimulationResults.set(results);

    } else if (parsed.source === 'palette' && parsed.gateType) {
        const dropZone = (event.currentTarget as HTMLElement).closest('.wire-container');
        if (!dropZone) return;

        if (parsed.gateType === 'CONTROL' && (singleMode || numQubits < 2)) {
            console.error('Control gate requires at least 2 qubits');
            return;
        }

        // Dragged from the palette, add a new gate
        circuit.update((current) => {
            const isOccupied = current.gates.some(g => g.qubit === qubit && g.columnIndex === columnIndex);

            if (isOccupied) {
                console.warn(`Column ${columnIndex} on qubit ${qubit} is already occupied`);
                return current; // Do not add gate if the column is occupied
            }

            const newGate: GateInstance = {
                id: crypto.randomUUID(),
                gateType: parsed.gateType as GateType,
                qubit: singleMode ? 0 : qubit,
                columnIndex: columnIndex,
            };

            const newCircuit = {
                ...current,
                gates: [
                    ...current.gates,
                    newGate,
                ],
            };
            return newCircuit;
        });

        if (parsed.gateType === 'CONTROL') {
            console.log(`Place an X gate on the target qubit for CONTROL on qubit ${qubit}`);
        }

        // Re-run simulation
        const updatedCircuit = get(circuit);
        const results = singleMode ? simulateSingleQubit(updatedCircuit) : simulateMultipleQubits(updatedCircuit);
        SimulationResults.set(results);
    }
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
