import type { CircuitIR } from '../IR/schema';
import { importCircuit } from './IE';
import { fetchPublicCircuit } from '../api/publicApi';

/**
 * Share links: how a circuit gets from a link onto this board.
 *
 * Two link shapes, both handled here:
 *
 *   /?circuit=<uuid>     a saved circuit its owner has published
 *   /#handoff=<base64>   the whole circuit inline, no server round-trip
 *
 * The inline form uses the URL *fragment* deliberately — fragments are never
 * sent to a server, so a circuit shared this way never lands in an access log
 * or a proxy cache, and it is not bounded by any server's request-line limit.
 */

/** Wire envelope for the inline transport. Versioned separately from the IR so
 *  the envelope can gain fields without implying an IR schema change. */
export interface HandoffPayload {
	name?: string;
	ir: unknown;
}

export type Handoff = { kind: 'circuit'; circuitId: string } | { kind: 'inline'; encoded: string };

export interface ResolvedHandoff {
	ir: CircuitIR;
	name: string;
	/** Set only for `?circuit=` links, where the circuit has a server identity
	 *  worth preserving. A handoff from elsewhere gets a fresh local id. */
	circuitId?: string;
}

/**
 * Ceiling on an inline payload, in base64 characters.
 *
 * A maximally dense circuit is ~38 KB of base64 uncompressed, which is past
 * what is comfortable to paste, embed in an anchor, or hand to a QR code — and
 * gzip brings that same circuit under 2 KB. Refusing here surfaces an oversized
 * circuit at the boundary rather than as a mysterious truncation later; the
 * sender is told to save it and share the saved-circuit link instead.
 */
export const MAX_INLINE_PAYLOAD_CHARS = 8192;

/** Read whichever handoff the current URL carries, if any. */
export function readHandoffFromUrl(url: URL): Handoff | null {
	const circuitId = url.searchParams.get('circuit');
	if (circuitId) return { kind: 'circuit', circuitId };

	// The fragment is not a query string, but it is shaped like one.
	const fragment = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
	if (fragment) {
		const encoded = new URLSearchParams(fragment).get('handoff');
		if (encoded) return { kind: 'inline', encoded };
	}

	return null;
}

function base64UrlToBytes(encoded: string): Uint8Array {
	// Accept both base64url (what we emit) and standard base64, so a link that has
	// been through a tool using a stock encoder still decodes.
	const normalised = encoded.replace(/-/g, '+').replace(/_/g, '/');
	const padded = normalised.padEnd(Math.ceil(normalised.length / 4) * 4, '=');
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

async function gunzip(bytes: Uint8Array): Promise<string> {
	const stream = new Blob([bytes as BlobPart])
		.stream()
		.pipeThrough(new DecompressionStream('gzip'));
	return await new Response(stream).text();
}

/**
 * Decode an inline payload.
 *
 * The encoding is self-describing rather than signalled by a separate param:
 * after base64 decoding we sniff the gzip magic bytes (0x1f 0x8b) and inflate
 * only if they are present. That keeps one link format for both plain and
 * compressed payloads, so an uncompressed link built by hand still opens.
 *
 * Compression uses the platform's own DecompressionStream — no dependency.
 */
export async function decodeInlinePayload(encoded: string): Promise<HandoffPayload> {
	if (encoded.length > MAX_INLINE_PAYLOAD_CHARS) {
		throw new Error(
			`Inline circuit is too large (${encoded.length} characters, limit ` +
				`${MAX_INLINE_PAYLOAD_CHARS}). Use the handoff API for circuits this size.`
		);
	}

	let bytes: Uint8Array;
	try {
		bytes = base64UrlToBytes(encoded);
	} catch {
		throw new Error('Circuit link is malformed — the payload is not valid base64.');
	}

	let json: string;
	if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
		try {
			json = await gunzip(bytes);
		} catch {
			throw new Error('Circuit link is malformed — the compressed payload could not be read.');
		}
	} else {
		json = new TextDecoder().decode(bytes);
	}

	let payload: unknown;
	try {
		payload = JSON.parse(json);
	} catch {
		throw new Error('Circuit link is malformed — the payload is not valid JSON.');
	}

	if (typeof payload !== 'object' || payload === null || !('ir' in payload)) {
		throw new Error('Circuit link is malformed — no circuit found in the payload.');
	}

	return payload as HandoffPayload;
}

/**
 * Give every operation an id before validation.
 *
 * The wire format drops per-op ids: they are `crypto.randomUUID()` values that
 * mean nothing outside this browser and account for about a third of an
 * uncompressed payload. `validateCanonicalIR` requires them and enforces
 * uniqueness, so they are synthesised here — and regenerated even when the
 * sender supplied them, so a payload carrying duplicates cannot land two
 * operations that the board would then treat as one.
 */
function withFreshOperationIds(ir: unknown): unknown {
	if (typeof ir !== 'object' || ir === null) return ir;
	const candidate = ir as { operations?: unknown };
	if (!Array.isArray(candidate.operations)) return ir;

	return {
		...candidate,
		operations: candidate.operations.map((op) =>
			typeof op === 'object' && op !== null ? { ...op, id: crypto.randomUUID() } : op
		)
	};
}

/** Validate an IR that arrived from outside, normalising ids first. */
export function acceptForeignIR(ir: unknown): CircuitIR {
	const result = importCircuit(withFreshOperationIds(ir));
	if (!result.ok) {
		throw new Error(`Circuit failed validation: ${result.error}`);
	}
	return result.data;
}

/** Turn a handoff from the URL into a circuit ready for the board. */
export async function resolveHandoff(handoff: Handoff): Promise<ResolvedHandoff> {
	if (handoff.kind === 'circuit') {
		const circuit = await fetchPublicCircuit(handoff.circuitId);
		return {
			ir: acceptForeignIR(circuit.ir),
			name: circuit.name,
			circuitId: circuit.circuit_id
		};
	}

	const payload = await decodeInlinePayload(handoff.encoded);
	return {
		ir: acceptForeignIR(payload.ir),
		name: payload.name || 'Shared Circuit'
	};
}

/**
 * Drop the handoff from the address bar once it has been dealt with.
 *
 * Without this a refresh re-triggers the handoff — and worse, after the user
 * has edited and saved the circuit, reloading would silently throw their work
 * away and load the original again.
 */
export function clearHandoffFromUrl(): void {
	const url = new URL(window.location.href);
	url.searchParams.delete('circuit');
	if (url.hash) {
		const params = new URLSearchParams(url.hash.slice(1));
		params.delete('handoff');
		const rest = params.toString();
		url.hash = rest ? `#${rest}` : '';
	}
	window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

async function gzipToBytes(text: string): Promise<Uint8Array> {
	const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Build an inline handoff link — the whole circuit encoded in the URL, needing
 * no account and no server round-trip.
 *
 * The payload is gzipped before base64. `decodeInlinePayload` sniffs the gzip
 * magic bytes rather than being told, so this stays the same link format either
 * way; compressing matters because an uncompressed dense circuit is ~38 KB of
 * base64, well past MAX_INLINE_PAYLOAD_CHARS, while the same circuit gzips to
 * around 1.2 KB.
 *
 * Throws rather than returning an oversized link: better to fail here, where we
 * can say why, than to hand someone a URL the receiver will reject.
 */
export async function buildInlineLink(
	baseUrl: string,
	ir: CircuitIR,
	name?: string
): Promise<string> {
	const payload: HandoffPayload = {
		...(name ? { name } : {}),
		// Strip ids on the way out; the receiver regenerates them.
		ir: {
			...ir,
			operations: ir.operations.map(({ id: _id, ...rest }) => rest)
		}
	};
	const bytes = await gzipToBytes(JSON.stringify(payload));
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

	if (encoded.length > MAX_INLINE_PAYLOAD_CHARS) {
		throw new Error(
			'This circuit is too large to put in a link. Save it and share it from My Circuits instead.'
		);
	}

	return `${baseUrl.replace(/\/$/, '')}/#handoff=${encoded}`;
}
