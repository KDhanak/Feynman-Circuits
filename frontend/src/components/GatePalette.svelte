<script lang="ts">
	import { handlePaletteDrop, handleDoubleClick } from '../lib/dragDropUtils';
	import type { GateData } from '../lib/stores';
	import type { GateType } from '../lib/stores';
	import { circuit, SimulationResults } from '../lib/stores';

	export const gates: { type: GateType; name: string }[] = [
		{ type: 'X', name: 'X Gate' },
		{ type: 'Y', name: 'Y Gate' },
		{ type: 'Z', name: 'Z Gate' },
		{ type: 'H', name: 'H Gate' },
		{ type: 'S', name: 'S Gate' },
		{ type: 'T', name: 'T Gate' }
	];

	export function resetCircuit() {
    circuit.set({
        numQubits: 1,
        gates: [],
    });
    SimulationResults.set({
        probabilities: { '0': 1, '1': 0 }
    });
}
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

	<button
	on:click={() => resetCircuit() }
		type="button"
		aria-label="reset circuit"
		class="cursor-pointer rounded border px-4 py-2 bg-ternary-2 text-white hover:bg-ternary-2 border-white hover:text-ternary-3 hover:border-ternary-3"
	>
		Reset Circuit
	</button>
</div>
