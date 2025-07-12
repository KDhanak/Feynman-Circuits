<script lang="ts">
	import {
		circuit,
		SimulationResults,
		type CircuitState,
		type ErrorResponse,
		type GateType,
		type ExportCircuit,

		type ExportGate

	} from '$lib/stores';
	import { simulateSingleQubit, simulateMultipleQubits } from '$lib/simulator';
	import { importCircuit } from '$lib/IE';
	import ErrorDisplay from './ErrorDisplay.svelte';
	import MessageDisplay from './MessageDisplay.svelte';
	import Icon from '@iconify/svelte';
	import { fade, scale } from 'svelte/transition';

	let isEnlarged = false;
	let circuitInputJson = '';
	let errorMessage: string = '';
	let message: string = '';
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	$: {
		const state = $circuit;
		const results =
			state.numQubits === 1 ? simulateSingleQubit(state) : simulateMultipleQubits(state);
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
			const input: ExportCircuit = JSON.parse(circuitInputJson);
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
		const exported: ExportCircuit = {
			mode: mode,
			numQubits: numQubits,
			qubitLabels: qubitLabels,
			gates: gates.map(({ gateType, qubits, columnIndex, targetQubits, baseGate, controlQubits }) => ({
				gateType: gateType as GateType,
				qubits: qubits,
				columnIndex,
				...(gateType === 'CONTROLLED' && { baseGate: baseGate, controlQubits: controlQubits, targetQubits: targetQubits })
			}))
		};

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

	function toggleEnlarge() {
		isEnlarged = !isEnlarged;
	}
	function focusOnMount(node: HTMLElement) {
		node.focus();
		return;
	}
</script>

<div class="input">
	<div class="flex flex-col justify-end gap-2 mb-1 text-sm">
		<div class="flex justify-between">
			<h3 class="text-primary-1">Import/Export Circuit (JSON)</h3>
			<div class="flex gap-2">
				<Icon
					icon="mage:copy"
					role="button"
					class="text-white cursor-pointer"
					width="24"
					height="24"
					onclick={copyToClipboard}
				/>
				<Icon
					icon="iconoir:enlarge"
					role="button"
					class="text-white cursor-pointer"
					width="24"
					height="24"
					onclick={toggleEnlarge}
				></Icon>
			</div>
		</div>
		<textarea
			bind:value={circuitInputJson}
			class={`rounded border bg-transparent ${message ? 'border-success-1' : errorMessage ? 'border-ternary-1' : 'border-primary-2'} w-xs h-20 resize-none text-white`}
		>
		</textarea>
	</div>

	{#if isEnlarged}
		<div
			class="fixed inset-0 bg-transparent flex items-center justify-center z-50"
			transition:fade={{ duration: 200 }}
			role="button"
			tabindex="0"
			aria-label="Close enlarged circuit JSON editor"
			on:click={toggleEnlarge}
			on:keydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					toggleEnlarge();
				}
			}}
		>
			<div
				class="bg-background border border-success-1 p-4 rounded-md max-w-3xl w-full max-h-[80vh] flex flex-col"
				transition:scale={{ duration: 200, start: 0.8 }}
				role="dialog"
				aria-modal="true"
				tabindex="0"
				use:focusOnMount
				on:click|stopPropagation
				on:keydown={(e) => {
					if (e.key === 'Escape') {
						toggleEnlarge();
					}
				}}
			>
				<div class="flex justify-between mb-2">
					<h3 class="text-primary-1">Edit Circuit</h3>
					<button type="button" aria-label="Close dialog" on:click={toggleEnlarge}>
						<Icon
							icon="material-symbols:close"
							role="button"
							class="text-ternary-0 cursor-pointer"
							width="24"
							height="24"
							on:click={toggleEnlarge}
						/>
					</button>
				</div>
				<textarea
					bind:value={circuitInputJson}
					class="rounded border bg-transparent border-success-1 w-full h-[50vh] text-white p-2 resize-none"
				></textarea>
			</div>
		</div>
	{/if}

	<div class="flex gap-4 mt-2 items-center">
		<button
			on:click={loadCircuitInput}
			type="button"
			class="rounded-md px-3 py-1.5 text-sm border bg-secondary-1 text-secondary-2 hover:bg-secondary-3 border-secondary-4 hover:text-white hover:border-white cursor-pointer"
			>Import Circuit</button
		>
		<button
			on:click={exportCircuit}
			type="button"
			class="rounded-md px-3 py-1.5 border text-sm bg-secondary-1 text-secondary-2 hover:bg-secondary-3 border-secondary-4 hover:text-white hover:border-white cursor-pointer"
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
