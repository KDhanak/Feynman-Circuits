import { writable } from 'svelte/store';
import type { CircuitSummary } from '$lib/api/circuitApi';

// A saved copy of the first page of the user's circuits. When the My Circuits
// panel is opened again, it can show this copy right away while it fetches
// fresh data in the background, instead of showing a spinner every time.
// Only the first page is saved here. "Load more" results stay inside the component.
interface CircuitListCache {
	circuits: CircuitSummary[];
	total: number;
	hasMore: boolean;
	loaded: boolean;
}

const EMPTY: CircuitListCache = { circuits: [], total: 0, hasMore: false, loaded: false };

export const circuitListCache = writable<CircuitListCache>({ ...EMPTY });

// Save the first page we just got from the server.
export function setCircuitListCache(circuits: CircuitSummary[], total: number, hasMore: boolean) {
	circuitListCache.set({ circuits, total, hasMore, loaded: true });
}

// Update the cache after a delete, without fetching again. `deletedCount` lowers
// the total even for ids that are on a later page we did not save.
export function removeFromCircuitListCache(ids: string[], deletedCount = ids.length) {
	const idSet = new Set(ids);
	circuitListCache.update((c) =>
		c.loaded
			? {
					...c,
					circuits: c.circuits.filter((x) => !idSet.has(x.circuit_id)),
					total: Math.max(0, c.total - deletedCount)
				}
			: c
	);
}

// Update the cache after a rename, without fetching again.
export function renameInCircuitListCache(id: string, name: string) {
	circuitListCache.update((c) =>
		c.loaded
			? { ...c, circuits: c.circuits.map((x) => (x.circuit_id === id ? { ...x, name } : x)) }
			: c
	);
}

// Update the cache after making a circuit public/private, without fetching again,
// so the "Public" badge is still right after closing and reopening the panel
// (which loads from this cache).
export function setPublicInCircuitListCache(id: string, is_public: boolean) {
	circuitListCache.update((c) =>
		c.loaded
			? { ...c, circuits: c.circuits.map((x) => (x.circuit_id === id ? { ...x, is_public } : x)) }
			: c
	);
}

// Clear the whole cache (e.g. when the user signs out).
export function clearCircuitListCache() {
	circuitListCache.set({ ...EMPTY });
}
