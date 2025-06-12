<script lang="ts">
	import { SimulationResults } from '../lib/stores';
</script>

<div class="text-secondary-1">
	<p class="text-md  font-medium">Quantum State: <span class="text-sm  font-normal">{$SimulationResults.formattedState}</span></p>
	<p class="text-md  font-medium mt-5">Probabilities:</p>
	<ul>
		<li>|0⟩: {$SimulationResults.probabilities['0'].toFixed(2)}</li>
		<li>|1⟩: {$SimulationResults.probabilities['1'].toFixed(2)}</li>
	</ul>
</div>
