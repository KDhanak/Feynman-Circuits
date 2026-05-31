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

export async function listCircuits(): Promise<CircuitSummary[]> {
    const response = await api.get('/circuits/api/circuits/');
    return response.data;
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
