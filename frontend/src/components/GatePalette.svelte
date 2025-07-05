<script lang="ts">
	import { handlePaletteDrop, handleDoubleClick, handleTouchStart, handleTouchEnd, handleTouchMove } from '$lib/dragDropUtils';
	import type { GateData, GateType } from '$lib/stores';
	import { circuit } from '$lib/stores';
	import { resetCircuit } from '$lib/simulator';

	export const gates: { type: GateType; name: string; category: string }[] = [
		{ type: 'X', name: 'X Gate', category: 'single' },
		{ type: 'Y', name: 'Y Gate', category: 'single' },
		{ type: 'Z', name: 'Z Gate', category: 'single' },
		{ type: 'H', name: 'H Gate', category: 'single' },
		{ type: 'S', name: 'S Gate', category: 'single' },
		{ type: 'T', name: 'T Gate', category: 'single' },
		{ type: 'CONTROL', name: 'CONTROL', category: 'multi' }
	];

	$: isSingleMode = $circuit.numQubits === 1;
</script>

<div
	aria-label="Quantum Circuit Gate Palette"
	role="region"
	on:drop={handlePaletteDrop}
	on:dragover={(e) => e.preventDefault()}
	on:dragenter={(e) => e.currentTarget.classList.add('drop-target-active')}
	on:dragleave={(e) => e.currentTarget.classList.remove('drop-target-active')}
	class="mb-4 w-14/15 h-auto py-10 flex items-center justify-center gap-4 rounded-md border-2 border-secondary-3"
>
	{#each gates as gate}
		{#if isSingleMode ? gate.category === 'single' : true}
			<div
				title={gate.name}
				role="region"
				draggable="true"
				on:dragstart={(e) => {
					const dragData: GateData = { source: 'palette', gateType: gate.type };
					e.dataTransfer?.setData('application/json', JSON.stringify(dragData));
				}}
				on:dblclick={() => handleDoubleClick({ source: 'palette', gateType: gate.type })}
				on:touchstart={(e) => handleTouchStart(e, {source: 'palette', gateType: gate.type})}
				on:touchmove={handleTouchMove} 
				on:touchend={(e) => handleTouchEnd(e)}
				class="cursor-grab select-none rounded-md border px-4 py-2 bg-secondary-1 text-secondary-2 hover:bg-secondary-3 border-secondary-4 hover:text-white hover:border-white"
			>
				{gate.name}
			</div>
		{/if}
	{/each}

	<button
		on:click={() => resetCircuit()}
		type="button"
		aria-label="reset circuit"
		class="cursor-pointer rounded border px-4 py-2 bg-ternary-2 text-white hover:bg-ternary-2 border-white hover:text-ternary-3 hover:border-ternary-3"
	>
		Reset Circuit
	</button>
</div>

<style>
	.ghost-gate {
		pointer-events: none;
		opacity: 0.8;
	}
</style>
