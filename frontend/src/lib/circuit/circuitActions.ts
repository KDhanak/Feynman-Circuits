import { importCircuit, exportToOpenQasm, importFromOpenQasm } from './IE';
import { buildCanonicalString } from '$lib/circuit/circuitDataModal';
import type { CircuitIR } from '../IR/schema';
import { triggerSimulation, findNextAvailableColumn } from '$lib/circuit/dragDropUtils';
import { showNotification } from '../utils/notificationUtils';
import { circuitIR } from '$lib/IR/stores';
import { setNumQubitsIR } from '$lib/IR/operations';
import { circuitDataModalContent, showCircuitDataModal } from '$lib/stores/uiStores';
import { get } from 'svelte/store';

export async function copyToClipboard(content: string): Promise<void> {
    try {
        await navigator.clipboard.writeText(content);
        showNotification('Copied to clipboard!', 'success');
    } catch {
        showNotification('Failed to copy text. Please copy manually.', 'error');
    }
}

function downloadFile(filename: string, content: string, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function downloadCircuit(name: string, ir: CircuitIR): void {
    const content = buildCanonicalString(ir);
    downloadFile(`${name}.cir`, content, 'text/plain');
    showNotification('Circuit downloaded!', 'success');
}

export function importJson(jsonText: string): void {
    let ir: CircuitIR;
    try {
        const result = importCircuit(JSON.parse(jsonText));
        if (!result.ok) {
            showNotification(result.error, 'error');
            return;
        }
        ir = result.data;
    } catch {
        showNotification('Invalid JSON format', 'error');
        return;
    }

    circuitIR.set(ir);
    try {
        triggerSimulation(ir);
    } catch {
        showNotification('Circuit imported but simulation failed', 'error');
    }
    circuitDataModalContent.set(buildCanonicalString(ir));
    showNotification('Circuit imported successfully!', 'success');
    showCircuitDataModal.set(false);
}

export function downloadCircuitAsOpenQasm(name: string, ir: CircuitIR, version: '2.0' | '3.0' = '2.0'): void {
    const content = exportToOpenQasm(ir, { version, includeComments: true });
    downloadFile(`${name}.qasm`, content, 'text/plain');
    showNotification(`Circuit exported as OpenQasm ${version}!`, 'success');
}

export function applyBellPairPreset(): void {
    if (get(circuitIR).registers.q < 2) {
        setNumQubitsIR(2);
    }

    circuitIR.update((ir) => {
        const col = Math.max(findNextAvailableColumn(ir, 0), findNextAvailableColumn(ir, 1));
        const next: CircuitIR = {
            ...ir,
            operations: [
                ...ir.operations,
                {
                    id: crypto.randomUUID(),
                    kind: 'unitary',
                    gate: 'h',
                    column: col,
                    targets: [0],
                    controls: [],
                    antiControls: [],
                    params: []
                },
                {
                    id: crypto.randomUUID(),
                    kind: 'unitary',
                    gate: 'x',
                    column: col + 1,
                    targets: [1],
                    controls: [0],
                    antiControls: [],
                    params: []
                }
            ]
        };
        triggerSimulation(next);
        return next;
    });
    showNotification('Bell pair circuit applied!', 'success');
}

export function importOpenQasm(qasmText: string): void {
    const result = importFromOpenQasm(qasmText);
    if (!result.ok) {
        showNotification(result.error, 'error');
        return;
    }

    const ir = result.data;
    circuitIR.set(ir);
    try {
        triggerSimulation(ir);
    } catch {
        showNotification('Circuit imported but simulation failed', 'error');
    }
    circuitDataModalContent.set(exportToOpenQasm(ir, { version: '2.0', includeComments: true }));
    showNotification('Circuit imported from OpenQasm successfully!', 'success');
    showCircuitDataModal.set(false);
}
