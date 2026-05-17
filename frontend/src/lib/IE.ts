import type { CircuitIR } from "./IR/schema";
import { validateCanonicalIR } from "./IR/validate";
import type { ErrorResponse } from "./IR/schema";

export function importCircuit(input: unknown): CircuitIR | ErrorResponse {
    const valid = validateCanonicalIR(input);

    if (!valid.valid) {
        return { detail: valid.errors.join("; ") };
    }

    return input as CircuitIR;
}
