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

// add more mocks here if you need them
