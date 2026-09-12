import type { CircuitIR } from '../IR/schema';

/**
 * Client for the public /api/v1/ namespace.
 *
 * Uses plain `fetch` instead of the shared axios instance, on purpose. That
 * instance sets `withCredentials: true` and has a hook that refreshes the
 * login token after a 401. Using it for these cookie-free endpoints would send
 * login cookies that the API refuses (it replies with `Access-Control-Allow-
 * Origin: *`, which the browser will not accept together with cookies), and it
 * could start an unneeded login refresh for a visitor who is signed out.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface PublicCircuit {
	circuit_id: string;
	name: string;
	ir: CircuitIR;
	created_at: string;
	updated_at: string;
}

async function getJson<T>(path: string): Promise<T> {
	const response = await fetch(`${API_BASE}${path}`, {
		method: 'GET',
		credentials: 'omit',
		headers: { Accept: 'application/json' }
	});
	if (!response.ok) {
		throw new Error(`Request to ${path} failed with ${response.status}`);
	}
	return (await response.json()) as T;
}

/** Fetches a circuit that its owner has made public. Fails on 404, which is
 *  also what a private circuit returns, on purpose. */
export function fetchPublicCircuit(circuitId: string): Promise<PublicCircuit> {
	return getJson<PublicCircuit>(`/api/v1/circuits/${circuitId}/`);
}
