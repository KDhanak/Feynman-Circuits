import type { CircuitIR } from '$lib/IR/schema';
import { circuitToOpenQasm } from './openQasmConverter';

export type DataViewMode = 'cir' | 'qasm';
export type OpenQasmVersion = '2.0' | '3.0';

export function buildCanonicalString(ir: CircuitIR): string {
    return JSON.stringify(ir, null, 2);
}

export function buildQASMString(ir: CircuitIR, version: OpenQasmVersion = '2.0'): string {
    return circuitToOpenQasm(ir, { version, includeComments: true });
}
