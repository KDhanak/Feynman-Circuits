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

export async function upsertCircuit(circuit_id: string, name: string, ir: CircuitIR): Promise<void> {
    await api.put(`/circuits/api/circuits/${circuit_id}/`, { circuit_id, name, ir });
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
            params: { page, page_size: 100 },
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

export async function deleteCircuit(circuit_id: string): Promise<void> {
    await api.delete(`/circuits/api/circuits/${circuit_id}/`);
}
