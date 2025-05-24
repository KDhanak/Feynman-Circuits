import { circuit, SimulationResults, type CircuitState, type GateType } from './stores'
import { simulateSingleQubit } from '$lib/simulator';
import { get } from 'svelte/store';
import { type GateData } from './types';

export function handleGateDragStart(event: DragEvent, gateId: string) {
    const dragData: GateData = { source: 'wire', gateId };
    event.dataTransfer?.setData('application/json', JSON.stringify(dragData));
}

export function handleDragOver(event: DragEvent) {
    event.preventDefault(); // Needed to allow drop
}
//define the handleDrop function
export function handleDrop(event: DragEvent) {
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

    // Handle the drop based on the source of the drag data
    if (parsed.source === 'wire') {
        // Dragged from the wire, do nothing for now
        return;
    } else if (parsed.source === 'palette' && parsed.gateType) {
        // Dragged from the palette, add a new gate
        circuit.update((current) => {
            const newCircuit = {
                ...current,
                gates: [
                    ...current.gates,
                    {
                        id: crypto.randomUUID(),
                        gateType: parsed.gateType as GateType,
                        qubit: 0
                    }
                ]
            };
            return newCircuit;
        });

        // Re-run simulation
        const updatedCircuit = get(circuit);
        const results = simulateSingleQubit(updatedCircuit);
        SimulationResults.set(results);
    }
}

export function removeGate(gateId: string | undefined) {
    let updatedCircuit;
    circuit.update((current) => {
        const newCircuit = {
            ...current,
            gates: current.gates.filter((gate) => gate.id !== gateId)
        };
        updatedCircuit = newCircuit;
        return newCircuit;
    });

    if (!updatedCircuit) {
        updatedCircuit = get(circuit);
    }

    const results = simulateSingleQubit(updatedCircuit);
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
    const validGates: GateType[] = ['X', 'Y', 'Z', 'H', 'S', 'T'];

    if (gateData.source === 'palette') {
        const gateType = gateData.gateType as GateType;
        if (!validGates.includes(gateType)) {
            console.error(`Incalid gate type: ${gateType}`);
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
                        qubit: 0,
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
    const results = simulateSingleQubit(updatedCircuit);
    SimulationResults.set(results);
}
