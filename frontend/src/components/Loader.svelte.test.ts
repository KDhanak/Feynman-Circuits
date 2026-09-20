import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Loader from './Loader.svelte';

describe('Loader', () => {
	it('is hidden from screen readers when nearby text already says what is happening', () => {
		const { container } = render(Loader);
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('aria-hidden')).toBe('true');
		expect(svg?.getAttribute('role')).toBeNull();
	});

	it('announces the wait when it is the only thing on screen', () => {
		render(Loader, { props: { label: 'Running the experiment' } });
		const svg = screen.getByRole('status');
		expect(svg.getAttribute('aria-label')).toBe('Running the experiment');
		expect(svg.getAttribute('aria-hidden')).toBeNull();
	});

	it('maps the named sizes to pixels', () => {
		const { container } = render(Loader, { props: { size: 'md' } });
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('width')).toBe('28');
		expect(svg?.getAttribute('height')).toBe('28');
	});

	it('takes an exact size when one of the three named ones does not fit', () => {
		const { container } = render(Loader, { props: { size: 15 } });
		expect(container.querySelector('svg')?.getAttribute('width')).toBe('15');
	});

	it('draws in the colour of the text around it, so it follows the theme', () => {
		const { container } = render(Loader);
		const strokes = [...container.querySelectorAll('circle')].map((c) => c.getAttribute('stroke'));
		expect(strokes.filter(Boolean).every((s) => s === 'currentColor')).toBe(true);
	});
});
