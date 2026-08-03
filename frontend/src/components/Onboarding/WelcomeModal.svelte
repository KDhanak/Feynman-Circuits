<script lang="ts">
	import Icon from '@iconify/svelte';
	import { fade, scale } from 'svelte/transition';
	import { dismissWelcome, startTour } from '$lib/stores/onboardingStore';

	/**
	 * First-run gate: offer the tour, and take no for an answer. Shown once per
	 * browser, then only via the header's `?`.
	 *
	 * There is deliberately no "are you a researcher or a student?" fork here.
	 * The two audiences do want different things, but until the guided lessons
	 * exist there is only one tour to send them to, and a choice that leads
	 * everywhere it says it does is worse than no choice.
	 */
</script>

<div
	class="fixed inset-0 z-300 flex items-center justify-center"
	transition:fade={{ duration: 200 }}
>
	<button
		type="button"
		class="absolute inset-0 cursor-default"
		style="background: rgba(0,0,0,0.55)"
		aria-label="Close"
		on:click={dismissWelcome}
	></button>

	<div
		class="relative w-[90vw] max-w-md rounded-sm p-6 shadow-sm shadow-ternary-3"
		style="background-color: var(--color-surface);"
		role="dialog"
		aria-modal="true"
		aria-label="Welcome to Feynman Circuits"
		transition:scale={{ duration: 200, start: 0.9 }}
	>
		<button
			type="button"
			class="absolute right-3 top-3 cursor-pointer"
			aria-label="Close"
			on:click={dismissWelcome}
		>
			<Icon icon="material-symbols:close" width="20" height="20" class="text-red-500" />
		</button>

		<h2 class="text-lg font-semibold" style="color: var(--color-text);">
			Welcome to <span class="text-secondary-2">Feynman</span>Circuits
		</h2>
		<p class="mt-1 text-sm" style="color: var(--color-muted);">
			A quantum circuit simulator that re-runs as you type — no Run button, no install. Want a quick
			look around first?
		</p>

		<div class="mt-5 flex items-center justify-end gap-3">
			<button
				type="button"
				class="cursor-pointer text-xs underline underline-offset-2"
				style="color: var(--color-muted);"
				on:click={dismissWelcome}>No thanks, I'll explore</button
			>
			<button
				type="button"
				class="flex cursor-pointer items-center gap-1.5 rounded-sm bg-ternary-1 px-3 py-1.5 text-sm text-white transition-colors hover:bg-ternary-2"
				on:click={startTour}
			>
				<Icon icon="ph:play-bold" width="14" height="14" />
				Take the 45-second tour
			</button>
		</div>
	</div>
</div>
