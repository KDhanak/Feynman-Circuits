<script lang="ts">
	import { circuit } from '../lib/stores';
	import {
		handleDrop,
		handleDragOver,
		handleGateDragStart,
		handleDoubleClick,
		removeGate,
	} from '../lib/dragDropUtils';
</script>

<div
	role="region"
	aria-label="Quantum Circuit Wire Drop Zone"
	class="relative flex w-4/5 h-24 items-center border-black"
	on:drop={handleDrop}
	on:dragover={handleDragOver}
>
	<!-- Wire -->
	<div
		class="absolute left-0 rounded-full right-0 top-1/2 h-0.5 -translate-y-1/2 transform bg-primary-1"
	></div>

	<!-- Qubit circle -->
	<div
		class="z-10 flex h-11 w-11 select-none items-center justify-center rounded-full border-2 border-ternary-3 bg-ternary-2 text-md text-white shadow-lg"
	>
		|0⟩
	</div>

	<!-- Show gates placed on the wire -->
	{#each $circuit.gates as gate (gate.id)}
		<div
			role="button"
			aria-label={`Remove ${gate.gateType} gate with double-click, Delete key, or drag back to palette`}
			tabindex="0"
			draggable="true"
			on:dragstart={(e) => handleGateDragStart(e, gate.id)}
			on:dblclick={() => handleDoubleClick({ source: 'wire', gateId: gate.id })}
			on:keydown={(e) => e.key === 'Delete' && removeGate(gate.id)}
			class="z-10 ml-4 cursor-grab select-none rounded px-4 py-2 border bg-secondary-1 text-secondary-4 hover:bg-secondary-3 border-secondary-4 hover:text-white hover:border-white shadow"
		>
			{gate.gateType}
		</div>
	{/each}
</div>
