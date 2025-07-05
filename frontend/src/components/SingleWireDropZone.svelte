<script lang="ts">
	import { circuit, type GateInstance } from '../lib/stores';
	import {
		handleDrop,
		handleDragOver,
		handleGateDragStart,
		handleDoubleClick,
		removeGate,
		handleTouchEnd,
		handleTouchMove,
		handleTouchStart
	} from '../lib/dragDropUtils';
	import { get } from 'svelte/store';
	import { updateQubitLabel } from '$lib/qubitLables';

	let qubitIndex = 0;
	let label = get(circuit).qubitLabels?.[qubitIndex] ?? `Qubit ${qubitIndex}`;

	// Subscribe and sync label
	$circuit; // reactive trigger
	$: label = $circuit.qubitLabels?.[qubitIndex] ?? `Qubit ${qubitIndex}`;

	const MAX_COLUMNS = 29;
	const COLUMN_WIDTH = 58;
	const LABEL_WIDTH = 80;
	const GATE_OFFSET = LABEL_WIDTH + 44;
</script>

<div role="region" aria-label="Quantum Circuit Wire Drop Zone" class="wire-container">
	<!-- Wire -->
	<div
		class="absolute left-0 rounded-full right-0 top-1/2 h-0.5 -translate-y-1/2 transform bg-primary-1"
	>
		{#each Array(MAX_COLUMNS) as _, colIndex}
			<div
				class="dropzone h-12 top-1/2 -translate-y-1/2 transform"
				on:drop={(e) => handleDrop(e, colIndex, 0)}
				on:dragover={handleDragOver}
				role="button"
				aria-label={`Drop gate here at column ${colIndex + 1}`}
				tabindex="0"
				style="left: {GATE_OFFSET + colIndex * COLUMN_WIDTH}px;"
			></div>
		{/each}
	</div>

	<!-- Qubit circle -->
	<div
		class="z-10 flex h-11 w-11 select-none items-center justify-center rounded-full border-2 border-ternary-3 bg-ternary-2 text-md text-white shadow-lg"
	>
		|0⟩
	</div>

	<input
		type="text"
		bind:value={label}
		on:input={(e) => updateQubitLabel(qubitIndex, label)}
		placeholder="Label"
		class="z-10 w-15 h-7.5 px-1.5 cursor-text hover:scale-110 transition-transform duration-300 ease-in-out text-xs border border-ternary-3 text-black text-center rounded-md bg-purple-100 shadow-lg focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600"
	/>

	<!-- Show gates placed on the wire -->
	{#each $circuit.gates.filter((g: GateInstance) => g.qubit === 0) as gate (gate.id)}
		<div
			role="button"
			aria-label={`Remove ${gate.gateType} gate with double-click, Delete key, or drag back to palette`}
			tabindex="0"
			draggable="true"
			style="left: {GATE_OFFSET + gate.columnIndex * COLUMN_WIDTH}px;"
			on:dragstart={(e) => handleGateDragStart(e, gate.id)}
			on:dblclick={() => handleDoubleClick({ source: 'wire', gateId: gate.id })}
			on:touchstart={(e) => handleTouchStart(e, { source: 'wire', gateId: gate.id, gateType:gate.gateType })}
			on:touchmove={handleTouchMove}
			on:touchend={(e) => handleTouchEnd(e)}
			on:keydown={(e) => e.key === 'Delete' && removeGate(gate.id)}
			class="gate z-10 cursor-grab select-none rounded px-4 py-2 border bg-secondary-1 text-secondary-4 hover:bg-secondary-3 border-secondary-4 hover:text-white hover:border-white shadow"
		>
			{gate.gateType}
		</div>
	{/each}
</div>

<style>
	.wire-container {
		position: relative;
		display: flex;
		align-items: center;
		height: 6rem; /* ~96px */
		width: 95%;
		margin: 0 auto;
	}

	.dropzone {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 3.5rem; /* ~56px, a bit more fluid than 50px */
		background-color: transparent;
		transition: background-color 0.2s ease;
	}
	.dropzone:hover {
		background-color: rgba(255, 255, 255, 0.05);
	}

	.gate {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		z-index: 10;
	}

	/* Qubit circle styles (optional to isolate and adjust) */
	.wire-container > div:first-child + div {
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 2.75rem;
		width: 2.75rem;
		border: 2px solid var(--color-ternary-3);
		background-color: var(--color-ternary-2);
		color: white;
		font-size: 1rem;
		border-radius: 9999px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		margin-right: 0.5rem;
	}
</style>
