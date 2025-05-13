<script lang="ts">
	import { circuit, SimulationResults } from '../lib/stores';
	import { simulateSingleQubitX } from '../lib/simulator';
	import { get } from 'svelte/store';

	function isUUID(value: string): boolean {
		const uuidRejex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		return uuidRejex.test(value);
	}

	function handleDrop(event: DragEvent) {
		const gateData = event.dataTransfer?.getData('text/plain');
		console.log('Dropped gate type:', gateData);
		if (!gateData) return;

		if (isUUID(gateData)) {
			return;
		} else {
			// Add X gate to qubit 0
			circuit.update((current) => {
				return {
					...current,
					gates: [
						...current.gates,
						{
							id: crypto.randomUUID(),
							gateData: gateData as 'X',
							qubit: 0
						}
					]
				};
			});

			// Re-run simulation
			SimulationResults.set(simulateSingleQubitX(get(circuit)));
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault(); // Needed to allow drop
	}

	function removeGate(gateId: string) {
		circuit.update((current) => {
			return {
				...current,
				gates: current.gates.filter((gate) => gate.id !== gateId)
			};
		});

		SimulationResults.set(simulateSingleQubitX(get(circuit)));
	}

	function handlePaletteDrop(event: DragEvent) {
		event.preventDefault();
		const gateData = event.dataTransfer?.getData('text/plain');
		if (gateData && isUUID(gateData)) {
			removeGate(gateData);
		}
	}

	function handleGateDragStart(event: DragEvent, gateId: string) {
		event.dataTransfer?.setData('text/plain', gateId);
	}
</script>

<main class="flex min-h-screen flex-col items-center justify-center bg-gray-100 text-gray-800">
	<h1 class="mb-6 text-2xl font-bold">Quantum Circuit Simulator</h1>

	<!-- Gate Palette -->
	<div
		aria-label="Quantum Circuit Gate Palette"
		role="region"
		on:drop={handlePaletteDrop}
		on:dragover={(e) => e.preventDefault()}
		on:dragenter={(e) => e.currentTarget.classList.add('drop-target-active')}
		on:dragleave={(e) => e.currentTarget.classList.remove('drop-target-active')}
		class="mb-4 flex gap-4"
	>
		<div
			role="region"
			draggable="true"
			on:dragstart={(e) => e.dataTransfer?.setData('text/plain', 'X')}
			class="cursor-grab rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
		>
			X Gate
		</div>
	</div>

	<!-- Wire with Drop Zone -->
	<div
		role="region"
		aria-label="Quantum Circuit Wire Drop Zone"
		class="relative flex h-24 w-full max-w-2xl items-center border border-dashed border-black"
		on:drop={handleDrop}
		on:dragover={handleDragOver}
	>
		<!-- Wire -->
		<div class="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 transform bg-black"></div>

		<!-- Qubit circle -->
		<div
			class="z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-black bg-blue-500 text-sm text-white shadow-lg"
		>
			|0⟩
		</div>

		<!-- Show gates placed on the wire -->
		{#each $circuit.gates as gate (gate.id)}
			<div
				role="button"
				aria-label="Remove gate"
				tabindex="0"
				draggable="true"
				on:dragstart={(e) => handleGateDragStart(e, gate.id)}
				on:dblclick={() => removeGate(gate.id)}
				class="z-10 ml-4 cursor-grab select-none rounded bg-green-500 px-2 py-1 text-white shadow"
			>
				{gate.gateData}
			</div>
		{/each}
	</div>

	<!-- Simulation result -->
	<div class="mt-6">
		<p class="text-lg font-medium">Probabilities:</p>
		<ul>
			<li>|0⟩: {$SimulationResults?.probabilities['0'].toFixed(2)}</li>
			<li>|1⟩: {$SimulationResults?.probabilities['1'].toFixed(2)}</li>
		</ul>
	</div>
</main>

<style>
	.select-none {
		-webkit-user-select: none; /* Safari */
		-moz-user-select: none; /* Firefox */
		-ms-user-select: none; /* Internet Explorer/Edge */
		user-select: none; /* Standard */
	}
</style>
