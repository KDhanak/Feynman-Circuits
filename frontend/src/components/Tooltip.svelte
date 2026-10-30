<script lang="ts" context="module">
	import { writable } from 'svelte/store';

	// Which tooltip is open, shared by every Tooltip on the page. Only one can be
	// open at a time. Each click on an info icon stops the click from reaching
	// the window (so the gate drag logic doesn't see it), so the window click
	// handler alone could not close the tooltip that was open before.
	const openTooltip = writable<symbol | null>(null);
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import { positionPopover } from '$lib/utils/positionPopover';
	import type { TooltipMatrix } from '$lib/quantum/gates';

	export let quick: string;
	export let detail: string = '';
	export let matrix: TooltipMatrix | undefined = undefined;
	// Hide the "i" badge until the wrapped element is hovered or focused (on
	// devices with a mouse). Used on the gate palette, where a badge on every
	// tile doubled the visual noise. Touch devices still always show it.
	export let subtle = false;

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
		if (opening) position();
	}

	function close() {
		if (visible) openTooltip.set(null);
	}

	// Splits "e^{iθ}" into the plain part and the superscript part.
	function splitPower(entry: string): { base: string; power: string } {
		const m = entry.match(/^(.*)\^\{(.*)\}$/);
		return m ? { base: m[1], power: m[2] } : { base: entry, power: '' };
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
		<div
			bind:this={tooltipEl}
			style={posStyle}
			class="fixed z-200 flex rounded-md shadow-lg px-3 py-2 text-xs pointer-events-none bg-surface"
			style:gap={matrix ? `${MATRIX_GAP}px` : undefined}
		>
			<div class="min-w-0 flex-1">
				<p class="font-semibold mb-0.5 text-muted">{quick}</p>
				{#if detail}
					<p class="text-muted">{detail}</p>
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
						class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 w-max text-muted"
						aria-label="Gate matrix"
					>
						{#if matrix.scale}
							<span class="text-[10px] whitespace-nowrap">{matrix.scale}</span>
						{/if}
						<div
							class="matrix grid gap-x-2 gap-y-0.5 px-1.5 text-[10px] leading-none whitespace-nowrap"
							style:grid-template-columns="repeat({matrix.rows[0].length}, auto)"
						>
							{#each matrix.rows as row, r (r)}
								{#each row as entry, col (col)}
									{@const { base, power } = splitPower(entry)}
									<span class="text-center"
										>{base}{#if power}<sup class="text-[8px]">{power}</sup>{/if}</span
									>
								{/each}
							{/each}
						</div>
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
	@media (hover: hover) {
		.subtle .info-badge {
			opacity: 0;
		}
		.subtle:hover .info-badge,
		.subtle:focus-within .info-badge {
			opacity: 1;
		}
	}
	/* Square brackets drawn with borders, so they always match the matrix height. */
	.matrix {
		border-left: 1px solid currentColor;
		border-right: 1px solid currentColor;
		padding-top: 2px;
		padding-bottom: 2px;
		background:
			linear-gradient(currentColor, currentColor) top left / 4px 1px no-repeat,
			linear-gradient(currentColor, currentColor) bottom left / 4px 1px no-repeat,
			linear-gradient(currentColor, currentColor) top right / 4px 1px no-repeat,
			linear-gradient(currentColor, currentColor) bottom right / 4px 1px no-repeat;
	}
</style>
