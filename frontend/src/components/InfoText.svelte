<script lang="ts">
	// A label with a dotted underline that explains itself. Hovering only
	// brightens it. A click, a tap or Enter opens the explanation, and the same
	// again closes it.
	//
	// Use it for text. A whole container (a panel, a palette gate) keeps the
	// "i" badge from Tooltip.
	import { tick } from 'svelte';
	import { openTooltip } from '$lib/stores/uiStores';
	import { positionPopover } from '$lib/utils/positionPopover';

	export let quick: string;
	export let detail = '';
	// Extra classes for the label, e.g. its font.
	let className = '';
	export { className as class };

	const id = Symbol('info-text');
	$: visible = $openTooltip === id;

	let triggerEl: HTMLButtonElement;
	let popupEl: HTMLDivElement;
	let posStyle = '';

	async function open() {
		openTooltip.set(id); // opening this one closes any other
		await tick(); // wait for the popup to be in the DOM so we can measure it
		const { left, top, width } = positionPopover(
			triggerEl.getBoundingClientRect(),
			popupEl?.offsetHeight ?? 80
		);
		posStyle = `left:${left}px; top:${top}px; width:${width}px;`;
	}

	function close() {
		if (visible) openTooltip.set(null);
	}

	function onClick(e: MouseEvent) {
		e.stopPropagation(); // the window click below would close it straight away
		if (visible) close();
		else open();
	}
</script>

<svelte:window on:click={close} on:scroll={close} />

<button
	type="button"
	bind:this={triggerEl}
	class="info-text {className}"
	aria-expanded={visible}
	on:click={onClick}><slot /></button
>

{#if visible}
	<div
		bind:this={popupEl}
		style={posStyle}
		role="tooltip"
		class="fixed z-200 rounded-md shadow-lg px-3 py-2 text-xs pointer-events-none bg-surface border border-border text-left"
	>
		<p class="font-semibold mb-0.5">{quick}</p>
		{#if detail}
			<p class="text-muted">{detail}</p>
		{/if}
	</div>
{/if}

<style>
	.info-text {
		/* A button only so it can be tapped and reached by keyboard. It keeps the
		   label's own font, size and colour (no font or colour is set here). */
		display: inline;
		background: none;
		border: none;
		padding: 0;
		text-align: inherit;
		cursor: pointer;
		text-decoration: underline dotted;
		text-decoration-color: color-mix(in srgb, currentColor 55%, transparent);
		text-underline-offset: 3px;
		transition: color 0.15s ease;
	}
	/* Light up slightly on hover, and while its explanation is open: a tint of
	   the brand colour, which shows on both the light and the dark theme. */
	.info-text:hover,
	.info-text[aria-expanded='true'] {
		color: color-mix(in srgb, currentColor 65%, var(--color-branding));
		text-decoration-color: currentColor;
	}
</style>
