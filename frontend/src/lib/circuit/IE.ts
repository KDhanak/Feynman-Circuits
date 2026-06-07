import type { CircuitIR } from "../IR/schema";
import { validateCanonicalIR } from "../IR/validate";
import type { ErrorResponse } from "../IR/schema";
import { circuitToOpenQasm, openQasmToCircuit, type OpenQasmExportOptions } from "./openQasmConverter";

export function importCircuit(input: unknown): CircuitIR | ErrorResponse {
    const valid = validateCanonicalIR(input);

    if (!valid.valid) {
        return { detail: valid.errors.join("; ") };
    }

    return input as CircuitIR;
}

export function exportToOpenQasm(ir: CircuitIR, options?: OpenQasmExportOptions): string {
    return circuitToOpenQasm(ir, options);
}

export function importFromOpenQasm(qasmCode: string): CircuitIR | ErrorResponse {
    const circuit = openQasmToCircuit(qasmCode);
    if (!circuit) {
        return { detail: "Failed to parse OpenQasm code" };
    }
    return circuit;
}
