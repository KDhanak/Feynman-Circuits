<script lang="ts">
	// Import the stores we need to read from
	import { SimulationResults, circuit } from '../lib/stores';
	import { fade, scale } from 'svelte/transition';
	import Icon from '@iconify/svelte';

	// Define the display limit as a constant for easy configuration
	const DISPLAY_LIMIT = 2;
	const MAX_COLUMNS = 16;
	let isEnlarged = false;

	// This component's only job is to DISPLAY the results.
	// The logic for updating SimulationResults is correctly handled in `dragDropUtils.ts`
	// whenever the circuit changes. This is a better separation of concerns.

	function toggleEnlarge() {
		isEnlarged = !isEnlarged;
	}

	function focusOnMount(node: HTMLElement) {
		// Focus the element when it is mounted
		node.focus();
		return {
			destroy() {
				// No cleanup needed
			}
		};
	}

	function toEntriesArray(probObj: Record<string, number> | undefined) {
		if (!probObj) return [];
		return Object.entries(probObj).map(([state, prob]) => ({ state, prob }));
	}

	function chunkArray<T>(arr: T[], size: number) {
		const out: T[][] = [];
		for (let i = 0; i < arr.length; i += size) {
			out.push(arr.slice(i, i + size));
		}
		return out;
	}

	// reactive values that update when $SimulationResults changes
	$: probabilitiesArray = toEntriesArray($SimulationResults?.probabilities);
	$: columns = chunkArray(probabilitiesArray, MAX_COLUMNS);
</script>

<div class="text-secondary-1">
	<!-- If the number of qubits exceeds our limit, show a message -->
	{#if $circuit.numQubits > DISPLAY_LIMIT}
		<div class="p-4 border w-3/4 border-secondary-3 rounded-md bg-secondary-4/20 text-center">
			<p class="text-md font-medium">Display Limit Reached</p>
			<button
				type="button"
				class="text-sm mt-2 underline cursor-pointer"
				on:click={toggleEnlarge}
				aria-label="Enlarge the display to view full simulation results"
			>
				Click here to enlarge the display and view the full simulation results.
			</button>
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
					class="bg-background border border-secondary-3 p-4 rounded-md max-w-3xl w-full max-h-[80vh] flex flex-col"
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
					<div class="flex mb-2 justify-center">
						<h3 class="text-primary-1">Simulation Results</h3>
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
					<p class="text-md font-medium">
						Quantum State:
						<span class="text-sm font-normal">
							<!-- Ensure formattedState exists before displaying -->
							{$SimulationResults.formattedState ?? 'Calculating...'}
						</span>
					</p>

					<p class="text-md font-medium mt-5">Probabilities:</p>

					<!-- Dynamically render the probabilities for the current circuit -->
					{#if columns.length > 0}
						<div class="prob-columns" role="list" aria-label="Simulation probabilities">
							{#each columns as column}
								<div class="prob-column" role="listitem">
									{#each column as item}
										<div class="prob-row" role="group" aria-label={`state ${item.state}`}>
											<span class="state">|{item.state}⟩</span>
											<span class="prob">{(item.prob * 100).toFixed(2)}%</span>
										</div>
									{/each}
								</div>
							{/each}
						</div>
					{:else}
						<p>No probabilities available</p>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Otherwise, show the full simulation results -->
	{:else}
		<p class="text-md font-medium">
			Quantum State:
			<span class="text-sm font-normal">
				<!-- Ensure formattedState exists before displaying -->
				{$SimulationResults.formattedState ?? 'Calculating...'}
			</span>
		</p>

		<p class="text-md font-medium mt-5">Probabilities:</p>

		<!-- Dynamically render the probabilities for the current circuit -->
		{#if columns.length > 0}
			<div class="prob-columns" role="list" aria-label="Simulation probabilities">
				{#each columns as column}
					<div class="prob-column" role="listitem">
						{#each column as item}
							<div class="prob-row" role="group" aria-label={`state ${item.state}`}>
								<span class="state">|{item.state}⟩</span>
								<span class="prob">{(item.prob * 100).toFixed(2)}%</span>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		{:else}
			<p>No probabilities available</p>
		{/if}
	{/if}
</div>

<style>
	.prob-columns {
		display: flex;
		gap: 6rem;
		overflow-x: auto;
		padding: 0.5rem 0;
		align-items: flex-start;
	}

	.prob-column {
		display: flex;
		flex-direction: column;
		min-width: 7rem;
		background: var(--bg-muted, transparent);
		padding: 0.25rem;
		border-radius: 6px;
		box-sizing: border-box;
	}

	.prob-row {
		display: flex;
		justify-content: space-between;
		gap: 0.01rem;
		padding: 0.12rem 0;
		border-bottom: 1px solid rgba(174, 0, 255, 0.281);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace;
		font-size: 0.95rem;
	}

	.state {
		color: var(--muted-text);
	}

	.prob {
		font-weight: 600;
		color: var(--primary-text);
		min-width: 4.5rem;
		text-align: right;
	}

	[role='dialog'] .flex.mb-2.justify-center {
		position: relative;
		justify-content: center;
		padding-right: 2.5rem;
	}

	[role='dialog'] .flex.mb-2.justify-center > button {
		position: absolute;
		right: 0.5rem;
		top: 50%;
		transform: translateY(-50%);
		background: transparent;
		border: none;
		padding: 0;
	}
</style>
