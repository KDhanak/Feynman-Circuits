import { writable } from 'svelte/store';
import type { CircuitSummary } from '$lib/api/circuitApi';

// Module-level cache of the first page of the user's circuits, so reopening the
// My Circuits panel can render instantly from cache while it revalidates in the
// background (stale-while-revalidate) — instead of showing a spinner every time.
// Only the first page is cached; "Load more" results stay component-local.
interface CircuitListCache {
	circuits: CircuitSummary[];
	total: number;
	hasMore: boolean;
	loaded: boolean;
}

const EMPTY: CircuitListCache = { circuits: [], total: 0, hasMore: false, loaded: false };

export const circuitListCache = writable<CircuitListCache>({ ...EMPTY });

// Store the authoritative first page after a fetch.
export function setCircuitListCache(circuits: CircuitSummary[], total: number, hasMore: boolean) {
	circuitListCache.set({ circuits, total, hasMore, loaded: true });
}

// Reflect deletions without a refetch. `deletedCount` decrements the total even
// for ids that live on an uncached later page.
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

// Reflect a rename without a refetch.
export function renameInCircuitListCache(id: string, name: string) {
	circuitListCache.update((c) =>
		c.loaded
			? { ...c, circuits: c.circuits.map((x) => (x.circuit_id === id ? { ...x, name } : x)) }
			: c
	);
}

// Reflect a publish/unpublish without a refetch, so the "Public" badge survives
// closing and reopening the panel (which rehydrates from this cache).
export function setPublicInCircuitListCache(id: string, is_public: boolean) {
	circuitListCache.update((c) =>
		c.loaded
			? { ...c, circuits: c.circuits.map((x) => (x.circuit_id === id ? { ...x, is_public } : x)) }
			: c
	);
}

// Drop the cache entirely (e.g. on sign-out).
export function clearCircuitListCache() {
	circuitListCache.set({ ...EMPTY });
}
