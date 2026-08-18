import { api } from './axios';
import type { CircuitIR } from '../IR/schema';

export interface CircuitSummary {
	circuit_id: string;
	name: string;
	description: string;
	is_public: boolean;
	created_at: string;
	updated_at: string;
}

export interface UpsertResult {
	circuit_id: string;
	name: string;
}

// Returns what the server actually stored, which is not always what was sent:
// saving a circuit that was shared with you creates your own copy under a fresh
// id, and renames it if you already have one by that name. Callers must adopt
// the returned values or their next save will repeat the same collision.
export async function upsertCircuit(
	circuit_id: string,
	name: string,
	ir: CircuitIR
): Promise<UpsertResult> {
	const response = await api.put(`/circuits/api/circuits/${circuit_id}/`, {
		circuit_id,
		name,
		ir
	});
	return { circuit_id: response.data.circuit_id, name: response.data.name };
}

export async function getNextUntitledName(): Promise<string> {
	const response = await api.get('/circuits/api/circuits/next-name/');
	return response.data.name;
}

export interface PaginatedCircuits {
	results: CircuitSummary[];
	next: string | null;
	count: number;
}

export async function listCircuits(page = 1): Promise<PaginatedCircuits> {
	const response = await api.get('/circuits/api/circuits/', { params: { page } });
	const { results, next, count } = response.data;
	return { results, next, count };
}

// Fetch every circuit id across all pages (used by "select all"). Requests the
// server's max page size to minimise round-trips.
export async function fetchAllCircuitIds(): Promise<string[]> {
	const ids: string[] = [];
	let page = 1;
	for (;;) {
		const response = await api.get('/circuits/api/circuits/', {
			params: { page, page_size: 100 }
		});
		const { results, next } = response.data as PaginatedCircuits;
		for (const c of results) ids.push(c.circuit_id);
		if (!next) break;
		page += 1;
	}
	return ids;
}

export async function loadCircuit(circuit_id: string): Promise<CircuitIR> {
	const response = await api.get(`/circuits/api/circuits/${circuit_id}/`);
	return response.data.ir;
}

export async function renameCircuit(circuit_id: string, name: string): Promise<void> {
	await api.patch(`/circuits/api/circuits/${circuit_id}/`, { name });
}

// Publishing a circuit makes it readable by anyone through the public API at
// GET /api/v1/circuits/<id>/ — see docs/api-v1.md. Private circuits are
// indistinguishable from circuits that do not exist, so unsetting this fully
// revokes access.
export async function setCircuitPublic(circuit_id: string, is_public: boolean): Promise<void> {
	await api.patch(`/circuits/api/circuits/${circuit_id}/`, { is_public });
}

export async function deleteCircuit(circuit_id: string): Promise<void> {
	await api.delete(`/circuits/api/circuits/${circuit_id}/`);
}
