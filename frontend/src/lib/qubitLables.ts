import { circuit } from "./stores";
import type { CircuitState } from "./stores";

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

circuit.subscribe((current: CircuitState) => {
    const n = current.numQubits;
    const base = current.qubitLabels ?? generateDefaultQubitLabels(n);

    const trimmed = base.slice(0, n);
    while (trimmed.length < n) {
        trimmed.push(`Qubit ${trimmed.length}`);
    };

    if(trimmed.length !== (current.qubitLabels?.length ?? 0) || trimmed.some((l, i) => l !== (current.qubitLabels ?? [])[i])) {
        circuit.update(_ => ({
            ..._,
            qubitLabels: trimmed
        }));
    }
});
