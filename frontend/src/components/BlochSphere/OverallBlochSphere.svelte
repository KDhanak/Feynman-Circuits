<script lang="ts">
	import BlochSphere from './BlochSphere.svelte';
	import { SimulationResults } from '$lib/stores';
	import { computeOverallBlochVector } from '$lib/quantum/bloch';

	$: vectors = $SimulationResults.blochVectors ?? [];
	$: overall = computeOverallBlochVector(vectors);
</script>

<div class="overall-bloch">
	<BlochSphere vector={overall} label="Overall State" size={225} showAxisLabels={true} />
	<p class="note">Average of per-qubit Bloch vectors</p>
</div>

<style>
	.overall-bloch {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.note {
		font-size: 0.72rem;
		opacity: 0.75;
		margin-top: 0.1rem;
        color: white;
	}
</style>
