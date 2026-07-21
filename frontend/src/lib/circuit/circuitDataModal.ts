import type { CircuitIR } from '$lib/IR/schema';
import { circuitToOpenQasm } from './openQasmConverter';
import { circuitToQiskit } from './qiskitConverter';

export type DataViewMode = 'cir' | 'qasm' | 'qiskit';
export type OpenQasmVersion = '2.0' | '3.0';

export function buildCanonicalString(ir: CircuitIR): string {
    return JSON.stringify(ir, null, 2);
}

export function buildQASMString(ir: CircuitIR, version: OpenQasmVersion = '2.0'): string {
    return circuitToOpenQasm(ir, { version, includeComments: true });
}

export function buildQiskitString(ir: CircuitIR): string {
    return circuitToQiskit(ir, { includeComments: true });
}
