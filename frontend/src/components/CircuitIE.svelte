<script lang="ts">
	import { circuit, SimulationResults, type CircuitState } from '$lib/stores';
	import {
		importCircuit,
		simulateSingleQubit,
		type ErrorResponse,
		type ImportedCircuit
	} from '$lib/simulator';
	import { get } from 'svelte/store';
	import ErrorDisplay from './ErrorDisplay.svelte';

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

<div class="z-10 absolute input mt-6 bottom-20">
	<h3 class="text-primary">Import/Export Circuit (JSON)</h3>
	<textarea
		bind:value={circuitInputJson}
		class="rounded border border-primary-accent w-2xl h-20 resize-none text-white"
	></textarea>
	<div class="flex gap-4 mt-2 items-center">
		<button
			on:click={loadCircuitInput}
			type="button"
			class="rounded px-4 py-2 border bg-secondary-1 text-secondary-2 hover:bg-secondary-3 border-secondary-4 hover:text-white hover:border-white cursor-pointer"
			>Import Circuit</button
		>
		<button
			on:click={exportCircuit}
			type="button"
			class="rounded px-4 py-2 border bg-secondary-1 text-secondary-2 hover:bg-secondary-3 border-secondary-4 hover:text-white hover:border-white cursor-pointer"
			>Export Circuit</button
		>
		{#if errorMessage}
        <ErrorDisplay message={errorMessage} />
		{/if}
	</div>
</div>
