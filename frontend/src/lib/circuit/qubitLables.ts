import { circuitIR } from "../IR/stores";

export function generateDefaultQubitLabels(numQubits: number): string[] {
    return Array.from({ length: numQubits }, (_, i) => `Qubit ${i}`);
}

export function updateQubitLabel(index: number, newLabel: string) {
    circuitIR.update(current => {
        const labels = [...current.qubitLabels];
        labels[index] = newLabel;
        return { ...current, qubitLabels: labels };
    });
}
