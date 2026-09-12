<script lang="ts">
	import { tick, onMount, onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { positionPopover } from '$lib/utils/positionPopover';
	import Icon from '@iconify/svelte';

	/** Element to spotlight. When it can't be found the parent skips the step. */
	export let anchorEl: HTMLElement;
	export let title: string;
	export let body: string;
	export let stepIndex: number;
	export let stepCount: number;
	export let onNext: () => void;
	export let onBack: () => void;
	export let onSkip: () => void;

	let panelEl: HTMLDivElement;
	let panelStyle = '';
	let holeStyle = '';

	const PAD = 6; // space between the spotlight ring and the element

	async function place() {
		if (!anchorEl) return;
		await tick(); // panel must be in the DOM before we can measure its height

		const r = anchorEl.getBoundingClientRect();

		// The "hole" is a see-through box over the anchor with a very large shadow,
		// which darkens everything outside it using just one element.
		holeStyle = `left:${r.left - PAD}px; top:${r.top - PAD}px; width:${r.width + PAD * 2}px; height:${r.height + PAD * 2}px;`;

		const { left, top, width } = positionPopover(r, panelEl?.offsetHeight ?? 180, {
			maxWidth: 360,
			gap: 12
		});
		panelStyle = `left:${left}px; top:${top}px; width:${width}px;`;
	}

	// Move it again whenever the target changes, and keep it in place as things move.
	$: if (anchorEl) {
		void anchorEl;
		place();
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') onSkip();
		else if (e.key === 'ArrowRight' || e.key === 'Enter') onNext();
		else if (e.key === 'ArrowLeft') onBack();
		else return;
		e.preventDefault();
	}

	let observer: ResizeObserver | undefined;
	onMount(() => {
		// The anchor is scrolled into view first so the spotlight never lands
		// off-screen on a short screen.
		anchorEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		observer = new ResizeObserver(() => place());
		observer.observe(document.body);
		place();
	});
	onDestroy(() => observer?.disconnect());

	$: isLast = stepIndex === stepCount - 1;
</script>

<svelte:window on:resize={place} on:scroll={place} on:keydown={onKey} />

<!-- Dark overlay + spotlight. `pointer-events: none` so the ring never catches a
     click. Clicks are blocked by the separate backdrop below it. -->
<div class="pointer-events-none fixed inset-0 z-300" transition:fade={{ duration: 150 }}>
	<div
		class="absolute rounded-md transition-all duration-200 ease-out"
		style="{holeStyle} box-shadow: 0 0 0 9999px rgba(0,0,0,0.6); outline: 2px solid var(--color-ternary-1); outline-offset: 2px;"
	></div>
</div>

<!-- Blocks clicks on the rest of the page while the tour is running. Clicking
     the dark area closes the tour, which is what people expect from an overlay. -->
<div
	class="fixed inset-0 z-300"
	role="button"
	tabindex="-1"
	aria-label="Exit tour"
	on:click={onSkip}
	on:keydown={() => {}}
></div>

<div
	bind:this={panelEl}
	style={panelStyle}
	class="fixed z-301 rounded-sm p-4 shadow-lg shadow-ternary-3"
	role="dialog"
	aria-modal="true"
	aria-label={title}
	transition:fade={{ duration: 150 }}
>
	<div class="mb-1.5 flex items-start justify-between gap-2">
		<h2 class="text-sm font-semibold" style="color: var(--color-text);">{title}</h2>
		<button type="button" class="shrink-0 cursor-pointer" aria-label="Exit tour" on:click={onSkip}>
			<Icon icon="material-symbols:close" width="16" height="16" class="text-red-500" />
		</button>
	</div>

	<p class="text-xs leading-relaxed" style="color: var(--color-muted);">{body}</p>

	<div class="mt-3 flex items-center justify-between gap-2">
		<!-- Progress dots: simple, and they show that the tour is short. -->
		<div class="flex items-center gap-1" aria-label="Step {stepIndex + 1} of {stepCount}">
			{#each Array(stepCount) as _, i (i)}
				<span
					class="h-1.5 w-1.5 rounded-full transition-colors {i === stepIndex
						? 'bg-ternary-1'
						: 'bg-secondary-3/40'}"
				></span>
			{/each}
		</div>

		<div class="flex items-center gap-2">
			{#if stepIndex > 0}
				<button
					type="button"
					class="cursor-pointer rounded-sm border border-ternary-1 px-2.5 py-1 text-xs text-text transition-colors active:bg-ternary-1 active:text-white"
					on:click={onBack}>Back</button
				>
			{:else}
				<button
					type="button"
					class="cursor-pointer text-xs underline underline-offset-2"
					style="color: var(--color-muted);"
					on:click={onSkip}>Skip</button
				>
			{/if}
			<button
				type="button"
				class="cursor-pointer rounded-sm bg-ternary-1 px-2.5 py-1 text-xs text-white transition-colors hover:bg-ternary-2"
				on:click={onNext}>{isLast ? 'Done' : 'Next'}</button
			>
		</div>
	</div>
</div>

<style>
	/* Uses the same look as ConfirmDialog, so the tour feels like part of the
	   app and not like an add-on from some library. */
	div[role='dialog'] {
		background-color: var(--color-surface);
	}
</style>
