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
	import Icon from '@iconify/svelte';

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

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(circuitInputJson);
			alert('Text copied to clipboard!');
		} catch (error) {
			console.error('Failed to copy to clipboard', error);
			alert('Failed to copy text. Please try selecting and copying manually.');
		}
	}
</script>

<div class="z-10 absolute input mt-6 bottom-20">
	<div class="flex flex-col justify-end gap-2 mb-1 text-sm">
		<div class="flex justify-between">
			<h3 class="text-primary">Import/Export Circuit (JSON)</h3>
			<Icon
				icon="mage:copy"
				role="button"
				class="text-white cursor-pointer"
				width="24"
				height="24"
				onclick={copyToClipboard}
			/>
		</div>
		<textarea
			bind:value={circuitInputJson}
			class="rounded border bg-transparent border-primary-accent w-2xl h-20 resize-none text-white"
		>
		</textarea>
	</div>

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
	</div>
	<div class="absolute -bottom-12">
		{#if errorMessage}
			<ErrorDisplay message={errorMessage} />
		{/if}
	</div>
</div>
