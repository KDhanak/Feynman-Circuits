<script lang="ts">
	import BlochSphere from './BlochSphere.svelte';
	import { SimulationResults } from '$lib/stores';
	import { computeOverallBlochVector } from '$lib/quantum/bloch';

	$: vectors = $SimulationResults.blochVectors ?? [];
	$: overall = computeOverallBlochVector(vectors);
</script>

<div class="overall-bloch">
	<BlochSphere vector={overall} label="Overall State" size={200} showAxisLabels={true} />
</div>

<style>
	.overall-bloch {
		display: flex;
		flex-direction: column;
		align-items: center;
		font-family: 'Inter', 'Roboto', sans-serif;
		font-size: 0.5rem;
		color: white;
		letter-spacing: 0.05rem;
	}
</style>
