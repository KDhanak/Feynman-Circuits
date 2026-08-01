import type { CircuitIR } from '../IR/schema';
import { validateCanonicalIR } from '../IR/validate';
import {
	circuitToOpenQasm,
	openQasmToCircuit,
	type OpenQasmExportOptions
} from './openQasmConverter';
import { circuitToQiskit, qiskitToCircuit, type QiskitExportOptions } from './qiskitConverter';

export type ImportResult = { ok: true; data: CircuitIR } | { ok: false; error: string };

export function importCircuit(input: unknown): ImportResult {
	const valid = validateCanonicalIR(input);
	if (!valid.valid) {
		return { ok: false, error: valid.errors.join('; ') };
	}
	return { ok: true, data: input as CircuitIR };
}

export function exportToOpenQasm(ir: CircuitIR, options?: OpenQasmExportOptions): string {
	return circuitToOpenQasm(ir, options);
}

export function importFromOpenQasm(qasmCode: string): ImportResult {
	const circuit = openQasmToCircuit(qasmCode);
	if (!circuit) {
		return { ok: false, error: 'Failed to parse OpenQasm code' };
	}
	return { ok: true, data: circuit };
}

export function exportToQiskit(ir: CircuitIR, options?: QiskitExportOptions): string {
	return circuitToQiskit(ir, options);
}

export function importFromQiskit(pythonCode: string): ImportResult {
	const circuit = qiskitToCircuit(pythonCode);
	if (!circuit) {
		return { ok: false, error: 'Failed to parse Qiskit code' };
	}
	return { ok: true, data: circuit };
}
