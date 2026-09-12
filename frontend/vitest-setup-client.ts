import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// needed for svelte5 + jsdom, because jsdom does not support matchMedia
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	enumerable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn()
	}))
});

// needed for svelte5 + jsdom, because jsdom does not support ResizeObserver
class ResizeObserverMock {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
}
Object.defineProperty(window, 'ResizeObserver', {
	writable: true,
	enumerable: true,
	value: ResizeObserverMock
});

// needed for svelte5 + jsdom, because jsdom does not have localStorage
class LocalStorageMock {
	private store = new Map<string, string>();
	getItem = vi.fn((key: string) => this.store.get(key) ?? null);
	setItem = vi.fn((key: string, value: string) => this.store.set(key, String(value)));
	removeItem = vi.fn((key: string) => this.store.delete(key));
	clear = vi.fn(() => this.store.clear());
}
Object.defineProperty(window, 'localStorage', {
	writable: true,
	enumerable: true,
	value: new LocalStorageMock()
});

// needed for svelte5 + jsdom, because jsdom does not have the Web Animations
// API, which Svelte's `transition:` animations use. Any component that plays a
// transition when it first appears (e.g. the onboarding welcome modal) crashes without it.
class AnimationMock {
	onfinish: (() => void) | null = null;
	oncancel: (() => void) | null = null;
	currentTime = 0;
	startTime = 0;
	playbackRate = 1;
	effect = { getComputedTiming: () => ({ duration: 0, delay: 0 }) };
	play = vi.fn();
	pause = vi.fn();
	cancel = vi.fn();
	finish = vi.fn();
	addEventListener = vi.fn();
	removeEventListener = vi.fn();
}
Object.defineProperty(Element.prototype, 'animate', {
	writable: true,
	enumerable: true,
	value: vi.fn(() => new AnimationMock())
});

// add more mocks here if you need them
