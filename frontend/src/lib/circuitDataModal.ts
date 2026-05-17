import type { CircuitIR } from '$lib/IR/schema';

export type DataViewMode = 'cir';

export function buildCanonicalString(ir: CircuitIR): string {
    return JSON.stringify(ir, null, 2);
}
