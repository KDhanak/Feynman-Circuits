import { readable } from 'svelte/store';
import { browser } from '$app/environment';

// Matches Tailwind's `sm` breakpoint (640px). Below this = phone layout / tap-to-place.
const MOBILE_QUERY = '(max-width: 639px)';

// `true` when the viewport is phone-sized. Drives the mobile-only tap UI and
// layout changes. SSR-safe: defaults to `false` on the server, then corrects
// on the client once matchMedia is available.
export const isMobile = readable(false, (set) => {
	if (!browser) return;

	const mql = window.matchMedia(MOBILE_QUERY);
	set(mql.matches);

	const update = (e: MediaQueryListEvent) => set(e.matches);
	mql.addEventListener('change', update);

	return () => mql.removeEventListener('change', update);
});
