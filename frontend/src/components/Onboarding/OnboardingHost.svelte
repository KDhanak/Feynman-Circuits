<script lang="ts">
	import { onMount, tick } from 'svelte';
	import CoachMark from './CoachMark.svelte';
	import WelcomeModal from './WelcomeModal.svelte';
	import { TOUR_STEPS } from '$lib/onboarding/tourSteps';
	import { activeFlow, tourStep, endTour, maybeStartFirstRun } from '$lib/stores/onboardingStore';

	/**
	 * Runs whichever onboarding flow is active. It is added once at the top of the
	 * page, so the tour can highlight anything on screen, no matter which component
	 * it belongs to.
	 */

	let anchorEl: HTMLElement | null = null;

	/**
	 * Finds the current step's anchor, and moves on past any step whose target
	 * isn't on screen (the code panel is not shown on mobile). `dir` keeps skipping
	 * in the direction the user was going, so Back doesn't get stuck going back
	 * and forth on an optional step.
	 */
	async function resolveAnchor(dir: 1 | -1 = 1) {
		await tick();
		let i = $tourStep;

		while (i >= 0 && i < TOUR_STEPS.length) {
			const el = document.querySelector<HTMLElement>(TOUR_STEPS[i].anchor);
			if (el) {
				if (i !== $tourStep) tourStep.set(i);
				anchorEl = el;
				return;
			}
			// A required step with no anchor is a bug, not a normal layout case. But
			// skipping it is still better than leaving the user stuck in the middle of the tour.
			i += dir;
		}

		// Went past the first or last step, and there is nothing left to show.
		anchorEl = null;
		endTour();
	}

	$: if ($activeFlow === 'tour') {
		void $tourStep;
		resolveAnchor(lastDir);
	}

	let lastDir: 1 | -1 = 1;

	function next() {
		lastDir = 1;
		if ($tourStep >= TOUR_STEPS.length - 1) endTour();
		else tourStep.update((n) => n + 1);
	}

	function back() {
		lastDir = -1;
		tourStep.update((n) => Math.max(0, n - 1));
	}

	onMount(maybeStartFirstRun);
</script>

{#if $activeFlow === 'welcome'}
	<WelcomeModal />
{:else if $activeFlow === 'tour' && anchorEl}
	{#key $tourStep}
		<CoachMark
			{anchorEl}
			title={TOUR_STEPS[$tourStep].title}
			body={TOUR_STEPS[$tourStep].body}
			stepIndex={$tourStep}
			stepCount={TOUR_STEPS.length}
			onNext={next}
			onBack={back}
			onSkip={endTour}
		/>
	{/key}
{/if}
