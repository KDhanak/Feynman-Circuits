<script lang="ts">
	import { tick } from 'svelte';

	export let quick: string;
	export let detail: string = '';

	let visible = false;
	let triggerEl: HTMLButtonElement;
	let tooltipEl: HTMLDivElement;
	let posStyle = '';

	const MARGIN = 8; // keep this much gap from the viewport edges
	const GAP = 6; // gap between the trigger and the tooltip

	async function position() {
		if (!triggerEl) return;
		await tick(); // wait for the tooltip to be in the DOM so we can measure it

		const r = triggerEl.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		const width = Math.min(320, vw - MARGIN * 2);
		const height = tooltipEl?.offsetHeight ?? 120;

		// Horizontal: centre on the trigger, then clamp so neither side
		// spills off-screen — effectively flips to whichever side has room.
		let left = r.left + r.width / 2 - width / 2;
		left = Math.max(MARGIN, Math.min(left, vw - width - MARGIN));

		// Vertical: prefer below the trigger; flip above when there isn't room.
		let top: number;
		if (r.bottom + GAP + height + MARGIN <= vh) {
			top = r.bottom + GAP;
		} else if (r.top - GAP - height - MARGIN >= 0) {
			top = r.top - GAP - height;
		} else {
			// Doesn't fully fit either side — clamp into view.
			top = Math.max(MARGIN, Math.min(vh - height - MARGIN, r.bottom + GAP));
		}

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
