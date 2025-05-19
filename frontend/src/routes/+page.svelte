<script lang="ts">
	import { circuit, SimulationResults, type CircuitState, type GateType } from '../lib/stores';
	import {
		importCircuit,
		simulateSingleQubit,
		type ErrorResponse,
		type ImportedCircuit
	} from '../lib/simulator';
	import { get } from 'svelte/store';

	// Define the type for the drag data
	// This is used to transfer data during drag-and-drop operations
	interface DragData {
		source: 'palette' | 'wire';
		gateType?: string; // Present if source is 'palette'
		gateId?: string; // Present if source is 'wire'
	}

	//define the handleDrop function
	function handleDrop(event: DragEvent) {
		const gateData = event.dataTransfer?.getData('application/json');
		if (!gateData) return;

		let parsed: DragData;
		// Parse the drag data
		// If parsing fails, log the error and return
		// This is important to avoid breaking the app if the data format changes
		try {
			parsed = JSON.parse(gateData);
		} catch (error) {
			console.error('Failed to parse drag data in handleDrop:', error);
			return;
		}

		// Handle the drop based on the source of the drag data
		if (parsed.source === 'wire') {
			// Dragged from the wire, do nothing for now
			return;
		} else if (parsed.source === 'palette' && parsed.gateType) {
			// Dragged from the palette, add a new gate
			circuit.update((current) => {
				const newCircuit = {
					...current,
					gates: [
						...current.gates,
						{
							id: crypto.randomUUID(),
							gateType: parsed.gateType as GateType,
							qubit: 0
						}
					]
				};
				return newCircuit;
			});

			// Re-run simulation
			const updatedCircuit = get(circuit);
			const results = simulateSingleQubit(updatedCircuit);
			SimulationResults.set(results);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault(); // Needed to allow drop
	}

	function removeGate(gateId: string) {
		let updatedCircuit;
		circuit.update((current) => {
			const newCircuit = {
				...current,
				gates: current.gates.filter((gate) => gate.id !== gateId)
			};
			updatedCircuit = newCircuit;
			return newCircuit;
		});

		if (!updatedCircuit) {
			updatedCircuit = get(circuit);
		}

		const results = simulateSingleQubit(updatedCircuit);
		SimulationResults.set(results);
	}

	function handlePaletteDrop(event: DragEvent) {
		event.preventDefault();
		const gateData = event.dataTransfer?.getData('application/json');
		if (!gateData) return;

		let parsed: DragData;
		try {
			parsed = JSON.parse(gateData);
		} catch (error) {
			console.error('Failed to parse drag data in handlePaletteDrop:', error);
			return;
		}

		if (parsed.source === 'wire' && parsed.gateId) {
			removeGate(parsed.gateId);
		}
	}

	function handleGateDragStart(event: DragEvent, gateId: string) {
		const dragData: DragData = { source: 'wire', gateId };
		event.dataTransfer?.setData('application/json', JSON.stringify(dragData));
	}

	let circuitInputJson = '';
	let errorMessage: string = '';

	// Import circuit from user input
	// This function is called when the user clicks the "Import Circuit" button
	function loadCircuitInput() {
		try {
			const input: ImportedCircuit = JSON.parse(circuitInputJson);
			const result = importCircuit(input);
			if ('detail' in result) {
				errorMessage = (result as ErrorResponse).detail ?? 'Unknown error';
			} else {
				circuit.set(result as CircuitState);
				errorMessage = '';
				// Re-run simulation after loading the circuit
				const updatedCircuit = get(circuit);
				const results = simulateSingleQubit(updatedCircuit);
				SimulationResults.set(results);
			}
		} catch (error) {
			// Handle JSON parsing error
			errorMessage = 'Invalid JSON format';
			console.error('Error loading circuit input:', error);
		}
	}

	// Export the current circuit to JSON
	// This function is called when the user clicks the "Export Circuit" button
	function exportCircuit() {
		const currentCircuit = get(circuit);
		const exported: ImportedCircuit = {
			numQubits: currentCircuit.numQubits,
			gates: currentCircuit.gates.map((gate) => ({
				gate: gate.gateType as string,
				qubit: gate.qubit
			}))
		};
		circuitInputJson = JSON.stringify(exported, null, 2);
	}
</script>

<main class="flex min-h-screen flex-col items-center justify-center bg-gray-100 text-gray-800">
	<h1 class="mb-6 text-2xl font-bold">Feynman Circuits</h1>

	<!-- Gate Palette -->
	<div
		aria-label="Quantum Circuit Gate Palette"
		role="region"
		on:drop={handlePaletteDrop}
		on:dragover={(e) => e.preventDefault()}
		on:dragenter={(e) => e.currentTarget.classList.add('drop-target-active')}
		on:dragleave={(e) => e.currentTarget.classList.remove('drop-target-active')}
		class="mb-4 flex gap-4 border-2 border-transparent transition-colors"
	>
		<div
			role="region"
			draggable="true"
			on:dragstart={(e) => {
				const dragData: DragData = { source: 'palette', gateType: 'X' };
				e.dataTransfer?.setData('application/json', JSON.stringify(dragData));
			}}
			class="cursor-grab select-none rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
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
			class="z-10 flex h-10 w-10 select-none items-center justify-center rounded-full border-2 border-black bg-blue-500 text-sm text-white shadow-lg"
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
				on:dblclick={() => removeGate(gate.id)}
				on:keydown={(e) => e.key === 'Delete' && removeGate(gate.id)}
				class="z-10 ml-4 cursor-grab select-none rounded bg-green-500 px-2 py-1 text-white shadow hover:bg-green-600"
			>
				{gate.gateType}
			</div>
		{/each}
	</div>

	<!-- Simulation result -->
	<div class="mt-6">
		<p class="text-lg font-medium">Probabilities:</p>
		<ul>
			<li>|0⟩: {$SimulationResults.probabilities['0'].toFixed(2)}</li>
			<li>|1⟩: {$SimulationResults.probabilities['1'].toFixed(2)}</li>
		</ul>
	</div>
	<div class="input mt-6">
		<h3>Import/Export Circuit (JSON)</h3>
		<textarea bind:value={circuitInputJson}></textarea>
		<br>
		<button on:click={loadCircuitInput} type="button" class = "rounded bg-purple-200 px-4 py-2 text-purple-500 hover:bg-purple-700 cursor-pointer">Import Circuit</button>
		<br>
		<br>
		<button on:click={exportCircuit} type="button" class = "rounded bg-purple-200 px-4 py-2 text-purple-500 hover:bg-purple-700 cursor-pointer">Export Circuit</button>
		{#if errorMessage}
			<p class="error">{errorMessage}</p>
		{/if}
	</div>
</main>

<style>
	.select-none {
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
		user-select: none;
	}
</style>
