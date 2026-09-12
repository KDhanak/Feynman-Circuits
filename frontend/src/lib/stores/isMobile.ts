import { readable } from 'svelte/store';
import { browser } from '$app/environment';

// Matches Tailwind's `sm` breakpoint (640px). Below this = phone layout / tap-to-place.
const MOBILE_QUERY = '(max-width: 639px)';

// `true` when the screen is phone-sized. Turns on the mobile-only tap UI and
// layout changes. Safe for server-side rendering: it starts as `false` on the
// server, then updates in the browser once matchMedia is available.
export const isMobile = readable(false, (set) => {
	if (!browser) return;

	const mql = window.matchMedia(MOBILE_QUERY);
	set(mql.matches);

	const update = (e: MediaQueryListEvent) => set(e.matches);
	mql.addEventListener('change', update);

	return () => mql.removeEventListener('change', update);
});
