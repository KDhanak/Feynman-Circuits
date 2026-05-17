import type { CircuitIR } from "./IR/schema";
import type { ErrorResponse } from "./stores";
import { validateCanonicalIR } from "./IR/validate";

export function importCircuit(input: unknown): CircuitIR | ErrorResponse {
    const valid = validateCanonicalIR(input);

    if (!valid.valid) {
        return { detail: valid.errors.join("; ") };
    }

    return input as CircuitIR;
}
