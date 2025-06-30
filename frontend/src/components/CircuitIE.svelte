<script lang="ts">
	import {
		circuit,
		SimulationResults,
		type CircuitState,
		type ErrorResponse,
		type GateType,
		type ImportedCircuit
	} from '$lib/stores';
	import { simulateSingleQubit, simulateMultipleQubits } from '$lib/simulator';
	import { importCircuit } from '$lib/IE';
	import ErrorDisplay from './ErrorDisplay.svelte';
	import MessageDisplay from './MessageDisplay.svelte';
	import Icon from '@iconify/svelte';

	let circuitInputJson = '';
	let errorMessage: string = '';
	let message: string = '';
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

		$: {
			const state = $circuit;
			const results = state.numQubits === 1 ? simulateSingleQubit(state) : simulateMultipleQubits(state);
			SimulationResults.set(results);
		}

	function flash(opts: { text: string; isError?: boolean; duration?: number }) {
		const { text, isError = false, duration = 2000 } = opts;
		if (timeoutId) clearTimeout(timeoutId);
		if (isError) errorMessage = text;
		else message = text;
		timeoutId = setTimeout(() => {
			errorMessage = '';
			message = '';
		}, duration);
	}

	// Import circuit from user input
	// This function is called when the user clicks the "Import Circuit" button
	function loadCircuitInput() {
		try {
			const input: ImportedCircuit = JSON.parse(circuitInputJson);
			const result = importCircuit(input);
			if ('detail' in result) {
				errorMessage = (result as ErrorResponse).detail ?? 'Unknown error';
				flash({ text: errorMessage, isError: true });
			} else {
				circuit.set(result as CircuitState);
				flash({ text: 'Circuit loaded successfully!' });
			}
		} catch (error) {
			// Handle JSON parsing error
			flash({ text: 'Invalid JSON format', isError: true });
		}
	}

	// Export the current circuit to JSON
	// This function is called when the user clicks the "Export Circuit" button
	function exportCircuit() {
		const { numQubits, gates, qubitLabels, mode } = $circuit;
		const exported = {
			mode: mode,
			numQubits: numQubits,
			qubitLabels: qubitLabels,
			gates: gates.map(({ gateType, qubit, columnIndex, targetQubit }) => ({
				gate: gateType as GateType,
				qubit,
				columnIndex,
				...(gateType === 'CONTROL' && { targetQubit })
			}))
		} as ImportedCircuit;

		circuitInputJson = JSON.stringify(exported, null, 2);

		flash({ text: 'Circuit exported!' });
	}

	async function copyToClipboard() {
		errorMessage = '';
		try {
			await navigator.clipboard.writeText(circuitInputJson);
			message = 'Text copied to clipboard!';
			if (timeoutId) clearTimeout(timeoutId);
			timeoutId = setTimeout(() => {
				message = '';
			}, 500);
		} catch (error) {
			errorMessage = 'Failed to copy text. Please try selecting and copying manually.';
			if (timeoutId) clearTimeout(timeoutId);
			timeoutId = setTimeout(() => {
				errorMessage = '';
			}, 500);
		}
	}
</script>

<div class="input">
	<div class="flex flex-col justify-end gap-2 mb-1 text-sm">
		<div class="flex justify-between">
			<h3 class="text-primary-1">Import/Export Circuit (JSON)</h3>
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
			class={`rounded border bg-transparent ${message ? 'border-success-1' : errorMessage ? 'border-ternary-1' : 'border-primary-2'} w-xl h-20 resize-none text-white`}
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
			<ErrorDisplay {errorMessage} />
		{:else if message}
			<MessageDisplay {message} />
		{/if}
	</div>
</div>
