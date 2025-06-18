<script lang="ts">
	import { circuit, type GateInstance, universalNumQubits } from '../lib/stores';
	import {
		handleDrop,
		handleDragOver,
		handleGateDragStart,
		removeGate
	} from '../lib/dragDropUtils';

	const MAX_COLUMNS = 29;
	const COLUMN_WIDTH = 58;
	const GATE_OFFSET = 44;

	$: wires = Array.from({ length: $universalNumQubits }, (_, i) => ({
		id: `wire-${i}`,
		qubit: i
	}));
	$: circuit.update((c) => ({ ...c, numQubits: $universalNumQubits }));
</script>

<div
	role="region"
	aria-label="Quantum Circuit Multi-Wire Drop Zone"
	class="w-[95%] relative space-y-1"
>
	<!-- Draw vertical connector lines for multiqubit gates -->
	{#each $circuit.gates.filter((g) => g.gateType === 'CONTROL' && g.targetQubit !== undefined) as gate (gate.id + '-connector')}
		<!-- @ts-expect-error Safe because of filter -->
		<div
			class="absolute bg-secondary-4 w-1 z-0"
			style="
			left: {GATE_OFFSET + gate.columnIndex * COLUMN_WIDTH + 20}px;
			top: {Math.min(gate.qubit, gate.targetQubit!) * 56 + 28}px;
			height: {Math.abs(gate.qubit - gate.targetQubit!) * 56}px;
		"
		></div>
	{/each}
	{#each wires as wire (wire.id)}
		<div
			role="region"
			aria-label="Qubit ${wire.qubit} Wire Drop Zone"
			class="wire-container relative flex h-14 items-center"
		>
			<!-- Wire -->
			<div
				class="absolute left-0 rounded-full right-0 top-1/2 h-0.5 -translate-y-1/2 transform bg-primary-1"
			>
				{#each Array(MAX_COLUMNS) as _, colIndex}
					<div
						class="dropzone h-12 top-1/2 -translate-y-1/2 transform"
						on:drop={(e) => handleDrop(e, colIndex, wire.qubit)}
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

			<!-- Show gates placed on the wire -->
			{#each $circuit.gates as gate (gate.id)}
				{#if gate.qubit === wire.qubit || gate.targetQubit === wire.qubit}
					<div
						role="button"
						aria-label={`Remove ${gate.gateType} gate with double-click, Delete key, or drag back to palette`}
						tabindex="0"
						draggable="true"
						on:dragstart={(e) => handleGateDragStart(e, gate.id)}
						on:keydown={(e) => e.key === 'Delete' && removeGate(gate.id)}
						class="gate z-10 cursor-grab select-none rounded px-3 py-1.5 border bg-secondary-1 text-secondary-4 hover:bg-secondary-3 border-secondary-4 hover:text-white hover:border-white shadow"
						style="left: {GATE_OFFSET + gate.columnIndex * COLUMN_WIDTH}px;"
					>
						{#if gate.gateType === 'CONTROL'}
							{#if gate.qubit === wire.qubit}
								<!-- Render the CONTROL dot -->
								<span class="inline-block w-3 h-3 rounded-full bg-secondary-4"></span>
							{:else if gate.targetQubit === wire.qubit}
								<!-- Render the associated target (usually X) -->
								<span class="gate-label">X</span>
							{/if}
						{:else}
							<span class="gate-label">{gate.gateType}</span>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	{/each}
</div>

<style>
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
		cursor: grab;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		background-color: var(--color-secondary-1);
		color: var(--color-secondary-4);
		border: 1px solid var(--color-secondary-4);
		border-radius: 0.5rem;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
		white-space: nowrap;
		z-index: 10;
	}
	.gate:hover {
		background-color: var(--color-secondary-3);
		color: white;
		border-color: white;
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
