import { api } from './axios';

export interface FeedbackPayload {
	type: 'bug' | 'feature';
	area: string;
	description: string;
	expected?: string;
	actual?: string;
	impact?: string;
	extra?: string;
	name?: string;
	email?: string;
}

export async function submitFeedback(payload: FeedbackPayload): Promise<void> {
	await api.post('/accounts/api/feedback/', payload);
}
