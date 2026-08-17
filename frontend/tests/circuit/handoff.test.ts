import { describe, it, expect } from 'vitest';
import {
	MAX_INLINE_PAYLOAD_CHARS,
	acceptForeignIR,
	buildInlineLink,
	decodeInlinePayload,
	readHandoffFromUrl,
	type HandoffPayload
} from '../../src/lib/circuit/handoff';
import type { CircuitIR } from '../../src/lib/IR/schema';

const BELL: CircuitIR = {
	version: '1.0',
	registers: { q: 2, c: 0 },
	qubitLabels: ['Qubit 0', 'Qubit 1'],
	operations: [
		{
			id: crypto.randomUUID(),
			kind: 'unitary',
			gate: 'h',
			column: 0,
			targets: [0],
			controls: [],
			antiControls: [],
			params: []
		},
		{
			id: crypto.randomUUID(),
			kind: 'unitary',
			gate: 'x',
			column: 1,
			targets: [1],
			controls: [0],
			antiControls: [],
			params: []
		}
	]
};

function encodeBase64Url(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function gzipBase64Url(value: string): Promise<string> {
	const stream = new Blob([value]).stream().pipeThrough(new CompressionStream('gzip'));
	const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('readHandoffFromUrl', () => {
	it('reads a published circuit id from the query string', () => {
		const url = new URL('https://app.example/?circuit=abc-123');
		expect(readHandoffFromUrl(url)).toEqual({ kind: 'circuit', circuitId: 'abc-123' });
	});

	it('reads a handoff token from the query string', () => {
		const url = new URL('https://app.example/?import=tok_xyz');
		expect(readHandoffFromUrl(url)).toEqual({ kind: 'token', token: 'tok_xyz' });
	});

	it('reads an inline payload from the fragment', () => {
		const url = new URL('https://app.example/#import=SGVsbG8');
		expect(readHandoffFromUrl(url)).toEqual({ kind: 'inline', encoded: 'SGVsbG8' });
	});

	it('returns null for a plain URL', () => {
		expect(readHandoffFromUrl(new URL('https://app.example/'))).toBeNull();
	});

	it('ignores unrelated query and fragment params', () => {
		const url = new URL('https://app.example/?utm_source=x#section');
		expect(readHandoffFromUrl(url)).toBeNull();
	});
});

describe('decodeInlinePayload', () => {
	it('decodes an uncompressed base64url payload', async () => {
		const payload: HandoffPayload = { v: 1, name: 'Bell', source: 'quantumcanvas', ir: BELL };
		const decoded = await decodeInlinePayload(encodeBase64Url(JSON.stringify(payload)));
		expect(decoded.name).toBe('Bell');
		expect(decoded.source).toBe('quantumcanvas');
	});

	it('detects gzip from the magic bytes and inflates', async () => {
		const payload: HandoffPayload = { v: 1, name: 'Compressed', ir: BELL };
		const decoded = await decodeInlinePayload(await gzipBase64Url(JSON.stringify(payload)));
		expect(decoded.name).toBe('Compressed');
		expect((decoded.ir as CircuitIR).registers.q).toBe(2);
	});

	it('accepts standard base64 as well as base64url', async () => {
		const payload: HandoffPayload = { v: 1, ir: BELL };
		const json = JSON.stringify(payload);
		const bytes = new TextEncoder().encode(json);
		let binary = '';
		for (const byte of bytes) binary += String.fromCharCode(byte);
		const decoded = await decodeInlinePayload(btoa(binary));
		expect((decoded.ir as CircuitIR).registers.q).toBe(2);
	});

	it('rejects a payload over the size ceiling', async () => {
		const oversized = 'A'.repeat(MAX_INLINE_PAYLOAD_CHARS + 1);
		await expect(decodeInlinePayload(oversized)).rejects.toThrow(/too large/i);
	});

	it('rejects malformed base64', async () => {
		await expect(decodeInlinePayload('!!!not base64!!!')).rejects.toThrow(/malformed/i);
	});

	it('rejects valid base64 that is not JSON', async () => {
		await expect(decodeInlinePayload(encodeBase64Url('hello world'))).rejects.toThrow(
			/not valid JSON/i
		);
	});

	it('rejects JSON with no circuit in it', async () => {
		await expect(decodeInlinePayload(encodeBase64Url('{"v":1}'))).rejects.toThrow(
			/no circuit found/i
		);
	});
});

describe('acceptForeignIR', () => {
	it('accepts a circuit whose operations carry no ids', () => {
		const withoutIds = {
			...BELL,
			operations: BELL.operations.map(({ id: _id, ...rest }) => rest)
		};
		const ir = acceptForeignIR(withoutIds);
		expect(ir.operations).toHaveLength(2);
		for (const op of ir.operations) {
			expect(typeof op.id).toBe('string');
			expect(op.id.length).toBeGreaterThan(0);
		}
	});

	it('regenerates ids so a payload with duplicates cannot collapse two operations', () => {
		const duplicated = {
			...BELL,
			operations: BELL.operations.map((op) => ({ ...op, id: 'same-id' }))
		};
		const ir = acceptForeignIR(duplicated);
		const ids = new Set(ir.operations.map((op) => op.id));
		expect(ids.size).toBe(2);
	});

	it('rejects a circuit with a qubit index outside the register', () => {
		const bad = {
			...BELL,
			operations: [{ ...BELL.operations[0], targets: [7] }]
		};
		expect(() => acceptForeignIR(bad)).toThrow(/failed validation/i);
	});

	it('rejects a non-object payload', () => {
		expect(() => acceptForeignIR('not a circuit')).toThrow(/failed validation/i);
	});
});

describe('buildInlineLink', () => {
	it('round-trips a circuit through the inline transport', async () => {
		const link = buildInlineLink('https://app.example', BELL, 'Bell', 'feynman');
		const encoded = new URL(link).hash.replace('#import=', '');
		const decoded = await decodeInlinePayload(encoded);
		const ir = acceptForeignIR(decoded.ir);

		expect(decoded.name).toBe('Bell');
		expect(ir.registers).toEqual(BELL.registers);
		expect(ir.operations.map((op) => op.gate)).toEqual(['h', 'x']);
	});

	it('strips per-operation ids to keep the link short', async () => {
		const link = buildInlineLink('https://app.example', BELL);
		const encoded = new URL(link).hash.replace('#import=', '');
		const decoded = await decodeInlinePayload(encoded);
		const operations = (decoded.ir as { operations: Array<Record<string, unknown>> }).operations;
		for (const op of operations) {
			expect(op).not.toHaveProperty('id');
		}
	});

	it('keeps a typical circuit well inside the size ceiling', () => {
		const link = buildInlineLink('https://app.example', BELL, 'Bell');
		const encoded = new URL(link).hash.replace('#import=', '');
		expect(encoded.length).toBeLessThan(MAX_INLINE_PAYLOAD_CHARS);
	});

	it('tolerates a base URL with a trailing slash', () => {
		expect(buildInlineLink('https://app.example/', BELL)).toContain('https://app.example/#import=');
	});
});
