import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import QecPanel from './QecPanel.svelte';
import { currentStep, qecResult, qecRunning } from '$lib/qec/stores';

// These two notes are what make design criteria C2 and C12 pass in the
// report. If someone removes them, the report would be claiming something the
// app no longer does, so they are pinned here.

beforeEach(() => {
	qecResult.set(null);
	currentStep.set(0);
	qecRunning.set(false);
});

describe('QecPanel', () => {
	it('says injected errors are ground truth that real hardware never shows', () => {
		render(QecPanel);
		expect(
			screen.getByText(/Real hardware never shows which physical error happened/)
		).toBeTruthy();
	});

	it('lists what the simulation leaves out', () => {
		render(QecPanel);
		expect(screen.getByText('What this simulation leaves out')).toBeTruthy();
		expect(screen.getByText('Distance 3 only.')).toBeTruthy();
		expect(screen.getByText('No gate or measurement errors in your run.')).toBeTruthy();
		expect(
			screen.getByText(
				'The decoder uses an assumed noise model, not one measured on real hardware.'
			)
		).toBeTruthy();
	});
});
