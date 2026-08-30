import type { CircuitIR } from '../IR/schema';

/**
 * Client for the public /api/v1/ namespace.
 *
 * Uses bare `fetch` rather than the shared axios instance on purpose. That
 * instance sets `withCredentials: true` and installs a 401 -> token-refresh
 * interceptor; pointing it at these cookie-free endpoints would attach
 * credentials the API explicitly refuses (it answers `Access-Control-Allow-
 * Origin: *`, which the browser will not honour alongside credentials) and
 * could kick off a spurious session refresh for a signed-out visitor.
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

/** Fetch a circuit its owner has marked public. Rejects on 404 — which is also
 *  what a private circuit returns, deliberately. */
export function fetchPublicCircuit(circuitId: string): Promise<PublicCircuit> {
	return getJson<PublicCircuit>(`/api/v1/circuits/${circuitId}/`);
}
