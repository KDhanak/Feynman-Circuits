<script lang="ts">
	import { handlePaletteDrop, handleDoubleClick } from '../lib/dragDropUtils';
	import { gates } from '../lib/types';
	import type { GateData } from '../lib/types';
</script>

<div
	aria-label="Quantum Circuit Gate Palette"
	role="region"
	on:drop={handlePaletteDrop}
	on:dragover={(e) => e.preventDefault()}
	on:dragenter={(e) => e.currentTarget.classList.add('drop-target-active')}
	on:dragleave={(e) => e.currentTarget.classList.remove('drop-target-active')}
	class="mb-4 w-4/5 h-auto py-10 flex items-center justify-center gap-4 rounded-md border-2 border-secondary-3"
>
	{#each gates as gate}
		<div
			title={gate.name}
			role="region"
			draggable="true"
			on:dragstart={(e) => {
				const dragData: GateData = { source: 'palette', gateType: gate.type };
				e.dataTransfer?.setData('application/json', JSON.stringify(dragData));
			}}
			on:dblclick={() => handleDoubleClick({ source: 'palette', gateType: gate.type })}
			class="cursor-grab select-none rounded border px-4 py-2 bg-secondary-1 text-secondary-2 hover:bg-secondary-3 border-secondary-4 hover:text-white hover:border-white"
		>
			{gate.name}
		</div>
	{/each}
</div>
