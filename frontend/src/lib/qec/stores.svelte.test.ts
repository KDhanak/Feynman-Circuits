// Named .svelte.test.ts only so it runs in the jsdom test project: the QEC
// theme is a class on <html>, so this test needs a real document.
import { describe, it, expect, afterEach } from 'vitest';
import { qecMode } from './stores';

afterEach(() => qecMode.set(false));

describe('QEC theme', () => {
	it('puts the qec class on <html> while QEC mode is on, and removes it after', () => {
		qecMode.set(true);
		expect(document.documentElement.classList.contains('qec')).toBe(true);
		qecMode.set(false);
		expect(document.documentElement.classList.contains('qec')).toBe(false);
	});
});
