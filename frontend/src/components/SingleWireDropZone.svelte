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
	import WireBloch from './BlochSphere/WireBloch.svelte'

	let qubit = 0;
	let label = get(circuit).qubitLabels?.[qubit] ?? `Qubit ${qubit}`;

	// Subscribe and sync label
	$circuit; // reactive trigger
	$: label = $circuit.qubitLabels?.[qubit] ?? `Qubit ${qubit}`;

	const MAX_COLUMNS = 29;
	const COLUMN_WIDTH = 58;
	const LABEL_WIDTH = 80;
	const GATE_OFFSET = LABEL_WIDTH + 44;
</script>

<div role="region" aria-label="Quantum Circuit Wire Drop Zone" class="wire-container-upper">
	<!-- Wire -->
	<div
		class="wire-container absolute left-0 rounded-full right-0 top-1/2 h-0.5 -translate-y-1/2 transform bg-primary-1"
		data-qubit={qubit}
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
		<div class="wire-bloch-anchor">
			<WireBloch {qubit} />
		</div>
	</div>

	<!-- Qubit circle -->
	<div
		class="qubit-circle mr-2 z-10 flex h-11 w-11 select-none items-center justify-center rounded-full border-2 bg-ternary-2 border-ternary-3 text-md text-white shadow-lg"
	>
		|0⟩
	</div>

	<input
		type="text"
		bind:value={label}
		on:input={(e) => updateQubitLabel(qubit, label)}
		placeholder="Label"
		class="qubit-label z-10 w-15 h-7.5 px-1.5 cursor-text text-xs border border-ternary-3 text-black text-center rounded-md bg-purple-100 shadow-lg focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600"
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
			on:keydown={(e) => e.key === 'Delete' && removeGate(gate.id)}
			on:touchstart={(e) =>
				handleTouchStart(e, { source: 'wire', gateId: gate.id, gateType: gate.gateType })}
			on:touchmove={handleTouchMove}
			on:touchend={(e) => handleTouchEnd(e)}
			class="gate z-10 cursor-grab select-none rounded px-4 py-2 border bg-secondary-1 text-secondary-4 hover:bg-secondary-3 border-secondary-4 hover:text-white hover:border-white shadow"
		>
			{gate.gateType}
		</div>
	{/each}
</div>

<style>
	.wire-container-upper {
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

	/* Qubit label input hover effect */
	.qubit-label:hover {
		transform: scale(1.05);
		transition: transform 300ms ease-in-out;
	}

	.wire-bloch-anchor {
		position: absolute;
		right: 0.5rem;
		top: 50%;
		transform: translateY(-50%);
		z-index: 20;
	}
</style>
