/**
 * Safely pull `err.response.data` off an unknown thrown value (typically an
 * Axios error) without asserting `any`. Returns `undefined` when the shape
 * doesn't match, so callers can pass the result straight to
 * `normalizeBackendErrors`.
 */
export function extractResponseData(err: unknown): unknown {
	if (err && typeof err === 'object' && 'response' in err) {
		const response = (err as Record<string, unknown>).response;
		if (response && typeof response === 'object' && 'data' in response) {
			return (response as Record<string, unknown>).data;
		}
	}
	return undefined;
}

export function normalizeBackendErrors(data: unknown): Record<string, string> {
	if (!data || typeof data !== 'object') return {};

	return Object.fromEntries(
		Object.entries(data).map(([key, value]) => [
			key,
			Array.isArray(value) ? String(value[0]) : String(value)
		])
	);
}

export function clearFields<T extends Record<string, unknown>>(obj: T, keys: (keyof T)[]): T {
	const copy = { ...obj };
	for (const key of keys) {
		delete copy[key];
	}
	return copy;
}
