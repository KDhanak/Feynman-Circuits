<script lang="ts">
	// Import the stores we need to read from
	import { SimulationResults, circuit } from '../lib/stores';

	// Define the display limit as a constant for easy configuration
	const DISPLAY_LIMIT = 3;

	console.log($SimulationResults);

	// This component's only job is to DISPLAY the results.
	// The logic for updating SimulationResults is correctly handled in `dragDropUtils.ts`
	// whenever the circuit changes. This is a better separation of concerns.
</script>

<div class="text-secondary-1">
	<!-- If the number of qubits exceeds our limit, show a message -->
	{#if $circuit.numQubits > DISPLAY_LIMIT}
		<div class="p-4 border border-secondary-3 rounded-md bg-secondary-4/20 text-center">
			<p class="text-md font-medium">Display Limit Reached</p>
			<p class="text-sm mt-2">
				The detailed quantum state and probabilities are only shown for circuits with {DISPLAY_LIMIT} or fewer qubits to ensure readability.
			</p>
		</div>

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
		<ul>
			{#if $SimulationResults && $SimulationResults.probabilities}
				{#each Object.entries($SimulationResults.probabilities) as [state, probability]}
					<li>|{state}⟩: {probability.toFixed(4)}</li>
				{/each}
			{/if}
		</ul>
	{/if}
</div>
