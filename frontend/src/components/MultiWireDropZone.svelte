<script lang="ts">
	import { circuit, isDragging } from '../lib/stores';
	import {
		handleDrop,
		handleDragOver,
		handleGateDragStart,
		handleDoubleClick,
		removeGate,
		handleTouchStart,
		handleTouchMove,
		handleTouchEnd
	} from '../lib/dragDropUtils';
	import { updateQubitLabel } from '$lib/qubitLables';
	import WireBloch from './BlochSphere/WireBloch.svelte';

	const MAX_COLUMNS = 29;
	const COLUMN_WIDTH = 58;
	const LABEL_WIDTH = 80;
	const GATE_OFFSET = LABEL_WIDTH + 44;
	const MAX_QUBITS = 8;

	$: wires = Array.from({ length: $circuit.numQubits }, (_, i) => ({
		id: `wire-${i}`,
		qubit: i
	}));

	$: showGhostWire = $isDragging && $circuit.numQubits < MAX_QUBITS;

	function removeQubitWire(qubitIndex: number) {
		const currentCircuit = $circuit;
		if (currentCircuit.numQubits <= 2) return; // Prevent removing below 2 qubits

		if (
			currentCircuit.gates.some(
				(gate) => gate.qubit === qubitIndex || gate.targetQubits?.includes(qubitIndex)
			)
		)
			return;

		const newQubitLabels = currentCircuit.qubitLabels
			? currentCircuit.qubitLabels.filter((_, idx) => idx !== qubitIndex)
			: [];

		circuit.set({
			...currentCircuit,
			numQubits: currentCircuit.numQubits - 1,
			qubitLabels: newQubitLabels
		});
	}
</script>

<div
	role="region"
	aria-label="Quantum Circuit Multi-Wire Drop Zone"
	class="w-[95%] relative space-y-4"
>
	<!-- Draw vertical connector lines for multiqubit gates -->
	{#each $circuit.gates.filter((g) => g.gateType === 'CONTROL' && (g.targetQubits?.length || g.targetQubit !== undefined)) as gate (gate.id + '-connector')}
		{#each (gate.targetQubits ?? (gate.targetQubit !== undefined ? [gate.targetQubit] : [])) as t}
			<div
				class="absolute bg-ternary-1 w-0.5 z-10"
				style="
			left: {GATE_OFFSET + gate.columnIndex * COLUMN_WIDTH + 18}px;
			top: {Math.min(gate.qubit, t) * 60 + 28}px;
			height: {Math.abs(gate.qubit - t) * 60}px;
        "
			></div>
		{/each}
	{/each}
	{#each wires as wire (wire.id)}
		<div
			role="region"
			aria-label="Qubit ${wire.qubit} Wire Drop Zone"
			class="wire-container-upper relative flex h-14 items-center"
			data-qubit={wire.qubit}
		>
			<!-- Wire -->
			<div
				class="wire-container absolute left-0 rounded-full right-0 top-1/2 h-0.5 -translate-y-1/2 transform bg-primary-1"
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
				<div class="wire-bloch-anchor">
					<WireBloch qubit={wire.qubit} />
				</div>
			</div>

			<!-- Qubit circle -->
			<div
				class={`qubit-circle mr-2 z-10 flex h-10 w-10 select-none items-center justify-center rounded-full border-2 bg-ternary-2 border-ternary-3 text-md text-white shadow-lg ${wire.qubit >= 2 ? 'cursor-pointer border-dotted active:border-solid active:border-amber-700 select-none' : 'cursor-default'}`}
				aria-label={`Qubit ${wire.qubit} - double click to remove wire`}
				role="button"
				tabindex="0"
				on:dblclick={() => removeQubitWire(wire.qubit)}
			>
				|0⟩
			</div>

			<input
				type="text"
				value={$circuit.qubitLabels?.[wire.qubit] ?? `Qubit ${wire.qubit}`}
				on:input={(e) => {
					const target = e.target as HTMLInputElement | null;
					if (target) updateQubitLabel(wire.qubit, target.value);
				}}
				placeholder="Label"
				class="qubit-label z-10 w-15 h-6.5 px-1.5 cursor-text text-xs border border-ternary-3 text-black text-center rounded-md bg-purple-100 shadow-lg focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600"
			/>

			<!-- Show gates placed on the wire -->
			{#each $circuit.gates as gate (gate.id)}
				{#if gate.qubit === wire.qubit}
					<div
						role="button"
						aria-label={`Remove ${gate.gateType} gate with double-click, Delete key, or drag back to palette`}
						tabindex="0"
						draggable="true"
						on:dragstart={(e) => handleGateDragStart(e, gate.id)}
						on:keydown={(e) => e.key === 'Delete' && removeGate(gate.id)}
						on:dblclick={() => handleDoubleClick({ source: 'wire', gateId: gate.id })}
						on:touchstart={(e) =>
							handleTouchStart(e, { source: 'wire', gateId: gate.id, gateType: gate.gateType })}
						on:touchmove={handleTouchMove}
						on:touchend={(e) => handleTouchEnd(e)}
						class="gate z-10 cursor-grab select-none rounded px-3 py-1.5 border bg-secondary-1 text-secondary-4 hover:bg-secondary-3 border-secondary-4 hover:text-white hover:border-white shadow"
						style="left: {GATE_OFFSET + gate.columnIndex * COLUMN_WIDTH}px;"
					>
						{#if gate.gateType === 'CONTROL'}
							{#if gate.qubit === wire.qubit}
								<!-- Render the CONTROL dot -->
								<span class="inline-block w-3 h-3 rounded-full bg-secondary-4"></span>
							{:else if gate.targetQubits ?? (gate.targetQubit !== undefined ? [gate.targetQubit] : []).includes(wire.qubit)}
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

	<!-- Ghost qubit wire for dynamic expansion -->
	{#if showGhostWire}
		<div
			role="region"
			aria-label="Ghost qubit wire for dynamic expansion"
			class="wire-container-upper ghost-wire relative flex h-14 items-center"
			data-qubit={$circuit.numQubits}
		>
			<!-- Wire -->
			<div
				class="wire-container absolute left-0 rounded-full right-0 top-1/2 h-0.5 -translate-y-1/2 transform bg-primary-1 opacity-30"
			>
				{#each Array(MAX_COLUMNS) as _, colIndex}
					<div
						class="dropzone h-12 top-1/2 -translate-y-1/2 transform"
						on:drop={(e) => handleDrop(e, colIndex, $circuit.numQubits)}
						on:dragover={handleDragOver}
						role="button"
						aria-label={`Add qubit and drop gate at column ${colIndex + 1}`}
						tabindex="0"
						style="left: {GATE_OFFSET + colIndex * COLUMN_WIDTH}px;"
					></div>
				{/each}
			</div>

			<!-- Ghost qubit circle -->
			<div
				class="z-10 mr-2 flex h-11 w-11 select-none items-center justify-center rounded-full border-2 border-dashed border-ternary-3 bg-ternary-2 text-md text-white shadow-lg opacity-50"
			>
				|0⟩
			</div>

			<input
				type="text"
				value="Qubit {$circuit.numQubits}"
				disabled
				placeholder="New Qubit"
				class="z-10 w-15 h-7.5 px-1.5 text-xs border border-dashed border-ternary-3 text-black text-center rounded-md bg-purple-100 bg-opacity-30 shadow-lg opacity-50"
			/>
		</div>
	{/if}
</div>

<style>
	.ghost-wire {
		opacity: 0.6;
	}

	.ghost-wire :global(.dropzone:hover) {
		background-color: rgba(100, 200, 255, 0.15);
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
		transition: transform 400ms ease-in-out;
	}

	.wire-bloch-anchor {
		position: absolute;
		right: 0.5rem;
		top: 50%;
		transform: translateY(-50%);
		z-index: 20;
	}
</style>
