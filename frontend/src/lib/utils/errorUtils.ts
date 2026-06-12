export function normalizeBackendErrors(data: any): Record<string, string> {
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
