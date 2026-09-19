import { api } from './axios';
import type { QecRequest, QecResult } from '../qec/schema';

// One QEC run. The backend builds the Stim circuit, runs it once, decodes it
// and sends back the full QecResult: what was placed, what the checks saw,
// and what the decoder guessed.
export async function runQec(request: QecRequest): Promise<QecResult> {
	const response = await api.post('/qec/api/qec/run/', request);
	return response.data;
}
