import { importCircuit, exportToOpenQasm, importFromOpenQasm } from './IE';
import { buildCanonicalString } from '$lib/circuit/circuitDataModal';
import type { CircuitIR } from '../IR/schema';
import { triggerSimulation } from '$lib/circuit/dragDropUtils';
import { showNotification } from '../utils/notificationUtils';
import { circuitIR } from '$lib/IR/stores';
import { circuitDataModalContent, showCircuitDataModal } from '$lib/stores/uiStores';

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
    try {
        const result = importCircuit(JSON.parse(jsonText));
        if ('detail' in result && !('version' in result)) {
            showNotification(result.detail ?? 'Unknown error', 'error');
            return;
        }
        const ir = result as CircuitIR;
        circuitIR.set(ir);
        triggerSimulation(ir);
        circuitDataModalContent.set(buildCanonicalString(ir));
        showNotification('Circuit imported successfully!', 'success');
    } catch {
        showNotification('Invalid JSON format', 'error');
    }
    showCircuitDataModal.set(false);
}

export function downloadCircuitAsOpenQasm(name: string, ir: CircuitIR, version: '2.0' | '3.0' = '2.0'): void {
    const content = exportToOpenQasm(ir, { version, includeComments: true });
    downloadFile(`${name}.qasm`, content, 'text/plain');
    showNotification(`Circuit exported as OpenQasm ${version}!`, 'success');
}

export function importOpenQasm(qasmText: string): void {
    try {
        const result = importFromOpenQasm(qasmText);
        if ('detail' in result && !('version' in result)) {
            showNotification(result.detail ?? 'Unknown error', 'error');
            return;
        }
        const ir = result as CircuitIR;
        circuitIR.set(ir);
        triggerSimulation(ir);
        circuitDataModalContent.set(exportToOpenQasm(ir, { version: '2.0', includeComments: true }));
        showNotification('Circuit imported from OpenQasm successfully!', 'success');
    } catch (err) {
        showNotification('Invalid OpenQasm format', 'error');
    }
    showCircuitDataModal.set(false);
}
