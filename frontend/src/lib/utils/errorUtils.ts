/**
 * Safely gets `err.response.data` from an unknown error (usually an Axios
 * error) without using `any`. Returns `undefined` when the error doesn't have
 * that shape, so callers can pass the result straight to
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
