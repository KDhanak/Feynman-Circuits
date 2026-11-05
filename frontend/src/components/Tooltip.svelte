<script lang="ts">
	// The "i" badge on a whole container, such as a palette gate or a panel.
	// A label in running text uses InfoText instead.
	//
	// Only one popup can be open at a time (openTooltip is shared). Each click on
	// an info icon stops the click from reaching the window (so the gate drag
	// logic doesn't see it), so the window click handler alone could not close
	// the popup that was open before.
	import { tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import { openTooltip } from '$lib/stores/uiStores';
	import { positionPopover } from '$lib/utils/positionPopover';
	import type { TooltipMatrix } from '$lib/quantum/gates';
	import MatrixView from './MatrixView.svelte';

	export let quick: string;
	export let detail: string = '';
	export let matrix: TooltipMatrix | undefined = undefined;
	// Hide the "i" badge until the wrapped element is hovered or focused (on
	// devices with a mouse). Used on the gate palette, where a badge on every
	// tile doubled the visual noise. Touch devices still always show it.
	export let subtle = false;
	// Several pages of info shown one at a time, with ‹ › arrows to slide
	// between them. When given, these replace `quick` and `detail`. The popup
	// always opens on the first page.
	export let pages: { quick: string; detail: string }[] | undefined = undefined;

	let page = 0;
	let slideDir = 1; // 1 = the new page comes in from the right, -1 = from the left
	$: shownQuick = pages ? pages[page].quick : quick;
	$: shownDetail = pages ? pages[page].detail : detail;

	function goTo(next: number) {
		if (!pages || next < 0 || next >= pages.length) return;
		slideDir = next > page ? 1 : -1;
		page = next;
		position(); // pages differ in height, so place the box again
	}

	// Extra classes for the wrapper. Needed when the tooltip's outer element IS part
	// of the layout (for example a grid item) and the caller has to place it. It
	// has a different name because `class` is a reserved word in a script block.
	let className = '';
	export { className as class };

	const id = Symbol('tooltip');
	$: visible = $openTooltip === id;

	// Same width the text always had. The matrix is added beside the text, and
	// the box gets wider by the matrix's width, so the text wraps the same way
	// as before and the box stays the same height.
	const TEXT_WIDTH = 320;
	const MATRIX_GAP = 12;

	let triggerEl: HTMLButtonElement;
	let tooltipEl: HTMLDivElement;
	let matrixEl: HTMLDivElement | undefined;
	let matrixWidth = 0;
	let posStyle = '';

	async function position() {
		if (!triggerEl) return;
		await tick(); // wait for the tooltip to be in the DOM so we can measure it

		matrixWidth = matrixEl?.offsetWidth ?? 0;
		const extra = matrixWidth ? matrixWidth + MATRIX_GAP : 0;
		const { left, top, width } = positionPopover(
			triggerEl.getBoundingClientRect(),
			tooltipEl?.offsetHeight ?? 120,
			{ maxWidth: TEXT_WIDTH + extra }
		);
		posStyle = `left:${left}px; top:${top}px; width:${width}px;`;
	}

	function toggle(e: MouseEvent) {
		e.stopPropagation(); // prevent the click bubbling to the gate drag logic
		const opening = !visible;
		openTooltip.set(opening ? id : null); // opening this one closes any other
		if (opening) {
			page = 0;
			position();
		}
	}

	function close() {
		if (visible) openTooltip.set(null);
	}
</script>

<svelte:window on:click={close} on:scroll={close} on:resize={() => visible && position()} />

<div role="group" class="tooltip-host relative inline-flex {className}" class:subtle>
	<slot />

	<!-- Info icon -->
	<button
		type="button"
		bind:this={triggerEl}
		on:click={toggle}
		class="info-badge absolute cursor-pointer -top-1.5 -right-1.5 z-10 flex items-center justify-center
               w-4 h-4 rounded-full text-[9px] font-bold leading-none"
		aria-label="More info"
	>
		i
	</button>

	{#if visible}
		<!-- A paged popup has arrows to click, so it takes clicks, and keeps them
		     from reaching the window (which would close it). -->
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div
			bind:this={tooltipEl}
			style={posStyle}
			class="fixed z-200 flex rounded-md shadow-lg px-3 py-2 text-xs bg-surface"
			class:pointer-events-none={!pages}
			style:gap={matrix ? `${MATRIX_GAP}px` : undefined}
			on:click={(e) => pages && e.stopPropagation()}
		>
			<div class="min-w-0 flex-1 overflow-hidden">
				{#key page}
					<div in:fly={{ x: pages ? 24 * slideDir : 0, duration: pages ? 180 : 0 }}>
						<p class="font-semibold mb-0.5 text-muted">{shownQuick}</p>
						{#if shownDetail}
							<p class="text-muted">{shownDetail}</p>
						{/if}
					</div>
				{/key}

				{#if pages && pages.length > 1}
					<div class="mt-2 flex items-center justify-between">
						<button
							type="button"
							class="page-arrow"
							disabled={page === 0}
							on:click={() => goTo(page - 1)}
							aria-label="Previous page">‹</button
						>
						<div class="flex gap-1" aria-label="Page {page + 1} of {pages.length}">
							{#each pages as p, i (p.quick)}
								<button
									type="button"
									class="page-dot"
									class:active={i === page}
									on:click={() => goTo(i)}
									aria-label="Go to page {i + 1}"
								></button>
							{/each}
						</div>
						<button
							type="button"
							class="page-arrow"
							disabled={page === pages.length - 1}
							on:click={() => goTo(page + 1)}
							aria-label="Next page">›</button
						>
					</div>
				{/if}
			</div>

			{#if matrix}
				<!--
					The matrix column is as wide as the matrix but adds no height: the
					matrix itself is absolutely placed inside it, centred. So the box
					is always as tall as its text, whatever the matrix size.
				-->
				<div class="relative shrink-0" style:width="{matrixWidth}px">
					<div
						bind:this={matrixEl}
						class="absolute right-0 top-1/2 -translate-y-1/2 w-max text-muted"
						aria-label="Gate matrix"
					>
						<MatrixView rows={matrix.rows} scale={matrix.scale} />
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.info-badge {
		color: var(--color-muted);
		background: var(--color-surface);
		border: 1px solid var(--color-border-strong);
		transition: opacity 0.15s ease;
	}
	.info-badge:hover {
		color: var(--color-accent);
		border-color: var(--color-accent);
	}
	.page-arrow {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 0.375rem;
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
		color: var(--color-text);
		border: 1px solid var(--color-border);
		background: var(--color-surface-2);
	}
	.page-arrow:hover:not(:disabled) {
		border-color: var(--color-accent);
		color: var(--color-accent);
	}
	.page-arrow:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.page-dot {
		width: 0.375rem;
		height: 0.375rem;
		border-radius: 9999px;
		cursor: pointer;
		background: var(--color-border-strong);
	}
	.page-dot.active {
		background: var(--color-accent);
	}
	@media (hover: hover) {
		.subtle .info-badge {
			opacity: 0;
		}
		.subtle:hover .info-badge,
		.subtle:focus-within .info-badge {
			opacity: 1;
		}
	}
</style>
