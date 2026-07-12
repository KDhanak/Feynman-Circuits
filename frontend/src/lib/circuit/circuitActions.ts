import { importCircuit, exportToOpenQasm, importFromOpenQasm } from './IE';
import { buildCanonicalString } from '$lib/circuit/circuitDataModal';
import type { CircuitIR, CircuitOperation } from '../IR/schema';
import {
    triggerSimulation,
    findNextAvailableColumn,
    pendingControls,
    pendingAntiControls
} from '$lib/circuit/dragDropUtils';
import { showNotification } from '../utils/notificationUtils';
import { circuitIR } from '$lib/IR/stores';
import { setNumQubitsIR } from '$lib/IR/operations';
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
    showNotification('Circuit imported successfully!', 'success');
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

/**
 * Left-packs the circuit by removing empty column gaps (ASAP scheduling).
 *
 * Each operation is moved to the earliest column where every qubit it touches
 * (targets + controls + antiControls) is free. Taking the max free-column over
 * all involved qubits keeps multi-qubit ops (controls, SWAP) aligned in a single
 * column, and processing in column order preserves each qubit's gate sequence —
 * so the simulation result is unchanged, just visually tighter.
 */
export function compactCircuit(): void {
    if (get(circuitIR).operations.length === 0) {
        showNotification('Nothing to compact.', 'error');
        return;
    }

    const qubitsOf = (op: CircuitOperation): number[] =>
        op.kind === 'unitary'
            ? [...op.targets, ...op.controls, ...op.antiControls]
            : 'targets' in op
              ? (op.targets as number[])
              : [];

    circuitIR.update((ir) => {
        // Process operations left-to-right by their current column (stable sort
        // keeps same-column ops in their existing relative order).
        const sorted = [...ir.operations].sort((a, b) => a.column - b.column);

        const freeCol = new Array(ir.registers.q).fill(0);
        const remapped = sorted.map((op) => {
            const qs = qubitsOf(op);
            const col = qs.length ? Math.max(...qs.map((q) => freeCol[q] ?? 0)) : 0;
            for (const q of qs) freeCol[q] = col + 1;
            return { ...op, column: col } as CircuitOperation;
        });

        const next: CircuitIR = { ...ir, operations: remapped };
        triggerSimulation(next);
        return next;
    });

    // Uncommitted control dots are keyed by column, which we just remapped — drop
    // them so they don't linger at stale positions.
    pendingControls.set(new Map());
    pendingAntiControls.set(new Map());

    showNotification('Circuit compacted!', 'success');
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
    showNotification('Circuit imported from OpenQasm successfully!', 'success');
}
