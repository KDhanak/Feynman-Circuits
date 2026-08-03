<script lang="ts">
	import { tick } from 'svelte';
	import { positionPopover } from '$lib/utils/positionPopover';

	export let quick: string;
	export let detail: string = '';

	let visible = false;
	let triggerEl: HTMLButtonElement;
	let tooltipEl: HTMLDivElement;
	let posStyle = '';

	async function position() {
		if (!triggerEl) return;
		await tick(); // wait for the tooltip to be in the DOM so we can measure it

		const { left, top, width } = positionPopover(
			triggerEl.getBoundingClientRect(),
			tooltipEl?.offsetHeight ?? 120
		);
		posStyle = `left:${left}px; top:${top}px; width:${width}px;`;
	}

	function toggle(e: MouseEvent) {
		e.stopPropagation(); // prevent the click bubbling to the gate drag logic
		visible = !visible;
		if (visible) position();
	}

	function close() {
		visible = false;
	}
</script>

<svelte:window on:click={close} on:scroll={close} on:resize={() => visible && position()} />

<div role="group" class="relative inline-flex">
	<slot />

	<!-- Info icon -->
	<button
		type="button"
		bind:this={triggerEl}
		on:click={toggle}
		class="absolute cursor-pointer -top-1.5 -right-1.5 z-10 flex items-center justify-center
               w-4 h-4 rounded-full text-ternary-1 border border-ternary-1 text-[9px] font-bold leading-none bg-surface"
		aria-label="More info"
	>
		i
	</button>

	{#if visible}
		<div
			bind:this={tooltipEl}
			style={posStyle}
			class="fixed z-200 rounded-md shadow-lg px-3 py-2 text-xs pointer-events-none bg-surface"
		>
			<p class="font-semibold mb-0.5 text-muted">{quick}</p>
			{#if detail}
				<p class="text-muted">{detail}</p>
			{/if}
		</div>
	{/if}
</div>
