import type { CircuitIR } from '../IR/schema';
import { importCircuit } from './IE';
import { fetchPublicCircuit } from '../api/publicApi';

/**
 * Share links: how a circuit gets from a link onto this board.
 *
 * There are two kinds of link, and this file handles both:
 *
 *   /?circuit=<uuid>     a saved circuit that its owner has made public
 *   /#handoff=<base64>   the whole circuit inside the link, no server needed
 *
 * The second kind uses the URL *fragment* (the part after #) on purpose. The
 * browser never sends the fragment to a server, so a circuit shared this way
 * never ends up in a server log or a proxy cache, and no server limit on URL
 * length applies to it.
 */

/** The wrapper object for the circuit inside the link. It has its own version,
 *  separate from the IR, so we can add fields to it without it looking like
 *  the IR schema changed. */
export interface HandoffPayload {
	name?: string;
	ir: unknown;
}

export type Handoff = { kind: 'circuit'; circuitId: string } | { kind: 'inline'; encoded: string };

export interface ResolvedHandoff {
	ir: CircuitIR;
	name: string;
	/** Only set for `?circuit=` links, where the circuit already has an id on the
	 *  server that we want to keep. A circuit from any other link gets a new local id. */
	circuitId?: string;
}

/**
 * The largest circuit data allowed inside a link, in base64 characters.
 *
 * The fullest possible circuit is about 38 KB of base64 without compression.
 * That is too long to paste easily, put in a link, or turn into a QR code. With
 * gzip, that same circuit is under 2 KB. Stopping a too-big circuit here gives a
 * clear error right away, instead of a confusing cut-off link later. The sender
 * is told to save the circuit and share the saved-circuit link instead.
 */
export const MAX_INLINE_PAYLOAD_CHARS = 8192;

/** Reads the handoff from the current URL, if there is one. */
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
	// Accept both base64url (what we create) and normal base64, so a link that
	// went through some other tool that uses normal base64 still works.
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
 * Decodes the circuit data from inside a link.
 *
 * The data itself tells us whether it is compressed, so no extra URL param is
 * needed. After base64 decoding, we look for the two bytes every gzip file
 * starts with (0x1f 0x8b) and only unzip if they are there. This way one link
 * format works for both plain and compressed data, so an uncompressed link
 * made by hand still opens.
 *
 * Unzipping uses the browser's own DecompressionStream, so no extra library is needed.
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
 * Gives every operation an id before validation.
 *
 * The link format leaves out each operation's id. The ids are
 * `crypto.randomUUID()` values that mean nothing outside this browser, and they
 * take up about a third of the uncompressed data. `validateCanonicalIR` needs
 * them and checks that they are all different, so we make them here. We make
 * new ones even if the sender included ids, so that data with repeated ids
 * can't create two operations that the board would then treat as one.
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

/** Checks an IR that came from outside the app, after first giving it fresh ids. */
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
 * Removes the handoff from the address bar once it has been loaded.
 *
 * Without this, a page refresh would load the shared circuit again. Worse,
 * after the user has edited and saved the circuit, a reload would quietly
 * throw away their work and load the original again.
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
 * Builds a handoff link that holds the whole circuit inside the URL. It needs
 * no account and no server.
 *
 * The data is gzipped before base64. `decodeInlinePayload` checks the first
 * bytes to see if the data is gzipped, so the link format is the same either
 * way. Compressing is important: a full circuit without compression is about
 * 38 KB of base64, far more than MAX_INLINE_PAYLOAD_CHARS, while the same
 * circuit gzipped is only about 1.2 KB.
 *
 * Throws an error instead of returning a link that is too long. It is better
 * to fail here, where we can explain why, than to give someone a URL that the
 * receiver will reject.
 */
export async function buildInlineLink(
	baseUrl: string,
	ir: CircuitIR,
	name?: string
): Promise<string> {
	const payload: HandoffPayload = {
		...(name ? { name } : {}),
		// Remove the ids before sending. The receiver makes new ones.
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
