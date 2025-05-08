<script lang="ts">
	import { circuit, SimulationResults } from '../lib/stores';
	import { simulateSingleQubitX } from '../lib/simulator';
	import { get } from 'svelte/store';

	function handleDrop(event: DragEvent) {
		const gateType = event.dataTransfer?.getData('text/plain');
		console.log('Dropped gate type:', gateType);
		if (!gateType) return;

		// Add X gate to qubit 0
		circuit.update((current) => {
			return {
				...current,
				gates: [
					...current.gates,
					{
						id: crypto.randomUUID(),
						gateType: gateType as 'X',
						qubit: 0
					}
				]
			};
		});

		// Re-run simulation
		console.log(simulateSingleQubitX(get(circuit)));
		SimulationResults.set(simulateSingleQubitX(get(circuit)));
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault(); // Needed to allow drop
	}
</script>

<main class="flex min-h-screen flex-col items-center justify-center bg-gray-100 text-gray-800">
	<h1 class="mb-6 text-2xl font-bold">Quantum Circuit Simulator</h1>

	<!-- Gate Palette -->
	<div class="mb-4 flex gap-4">
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
			<div class="ml-4 rounded bg-green-500 px-2 py-1 text-white shadow">
				{gate.gateType}
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
