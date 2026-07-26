import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GATE_REGISTRY } from '$lib/quantum/gates';

const sharedGates: { id: string; qasmName: string; numParams: number; arity: number }[] =
	JSON.parse(readFileSync(join(__dirname, '../../../shared/gates.json'), 'utf-8'));

describe('gates parity', () => {
	it('shared/gates.json contains exactly the same gate IDs as GATE_REGISTRY', () => {
		const registryIds = new Set(Object.keys(GATE_REGISTRY));
		const sharedIds = new Set(sharedGates.map((g) => g.id));

		const missingFromShared = [...registryIds].filter((id) => !sharedIds.has(id));
		const extraInShared = [...sharedIds].filter((id) => !registryIds.has(id));

		expect(missingFromShared, 'Gates in GATE_REGISTRY but missing from shared/gates.json').toEqual(
			[]
		);
		expect(extraInShared, 'Gates in shared/gates.json but not in GATE_REGISTRY').toEqual([]);
	});

	it('shared/gates.json numParams matches GATE_REGISTRY', () => {
		for (const entry of sharedGates) {
			const spec = GATE_REGISTRY[entry.id as keyof typeof GATE_REGISTRY];
			expect(spec, `${entry.id} in shared/gates.json not found in GATE_REGISTRY`).toBeDefined();
			expect(entry.numParams, `numParams mismatch for gate "${entry.id}"`).toBe(spec.numParams);
		}
	});
});
