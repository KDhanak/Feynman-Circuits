<script lang="ts">
	import { SimulationResults } from '../lib/stores';
</script>

<div class="mt-6">
	<p class="text-md text-primary font-medium">Quantum State: <span class="text-sm text-primary font-normal">{$SimulationResults.formattedState}</span></p>
	<p class="text-md text-primary font-medium mt-5">Probabilities:</p>
	<ul class="text-primary">
		<li>|0⟩: {$SimulationResults.probabilities['0'].toFixed(2)}</li>
		<li>|1⟩: {$SimulationResults.probabilities['1'].toFixed(2)}</li>
	</ul>
</div>
