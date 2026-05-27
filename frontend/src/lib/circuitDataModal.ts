import type { CircuitIR } from '$lib/IR/schema';

export type DataViewMode = 'cir' | 'qasm';

export function buildCanonicalString(ir: CircuitIR): string {
    return JSON.stringify(ir, null, 2);
}

export function buildQASMString(ir: CircuitIR): string {
    // Implementation for building OpenQASM string
    return 'Coming Soon...';
}
