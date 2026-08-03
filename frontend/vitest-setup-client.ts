import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// required for svelte5 + jsdom as jsdom does not support matchMedia
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

// required for svelte5 + jsdom as jsdom does not support ResizeObserver
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

// required for svelte5 + jsdom as jsdom does not provide localStorage
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

// required for svelte5 + jsdom as jsdom does not implement the Web Animations
// API, which Svelte's `transition:` directives drive. Any component rendering a
// transition on mount (e.g. the onboarding welcome modal) throws without it.
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
