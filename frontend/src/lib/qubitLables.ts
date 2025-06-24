import { circuit, universalNumQubits } from "./stores";

export function generateDefaultQubitLabels(numQubits: number): string[] {
    return Array.from({ length: numQubits }, (_, i) => `Qubit ${i}`);
}

export function updateQubitLabel(index: number, newLabel: string) {
    circuit.update(current => {
        const labels = [...(current.qubitLabels ?? generateDefaultQubitLabels(current.numQubits))];
        labels[index] = newLabel;
        return { ...current, qubitLabels: labels };
    });
};

universalNumQubits.subscribe(numQubits => {
    circuit.update(current => {
        const labels = current.qubitLabels ?? generateDefaultQubitLabels(numQubits);
        const updatedLabels = [...labels.slice(0, numQubits)];
        while (updatedLabels.length < numQubits) {
            updatedLabels.push(`Qubit ${updatedLabels.length}`);
        }
        return { ...current, qubitLabels: updatedLabels};
    });
});
