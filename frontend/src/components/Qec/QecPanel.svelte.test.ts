import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import QecPanel from './QecPanel.svelte';
import { currentStep, qecResult, qecRunning } from '$lib/qec/stores';
import type { QecResult } from '$lib/qec/schema';

// These two notes stop a learner from mistaking the simulation for real
// hardware. They are easy to delete by accident in a UI tidy-up, so they are
// pinned here.

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

	it("lists the decoder's pairings in words on the last step, with their rounds", () => {
		const snap = (phase: 'inject' | 'measure' | 'decode', round: number) => ({
			round,
			phase,
			truth: { injected: [] },
			measured: { syndrome: {}, detectionEvents: {} }
		});
		qecResult.set({
			layout: {} as QecResult['layout'],
			request: { rounds: 1, errors: [] },
			timeline: [snap('inject', 0), snap('measure', 0), snap('decode', 1)],
			inferred: {
				matching: [
					{ kind: 'pair', a: { round: 0, checkId: 'Z0' }, b: { round: 0, checkId: 'Z1' } }
				],
				correction: [],
				logical: { observedFlip: 0, predictedFlip: 0, success: true }
			}
		});
		currentStep.set(2);
		render(QecPanel);
		expect(
			screen.getByText(/^Z0 \(round 1\) paired with Z1 \(round 1\)/, { selector: 'li' })
		).toBeTruthy();
	});
});
