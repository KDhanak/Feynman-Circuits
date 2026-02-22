<script lang="ts">
	import BlochSphere from './BlochSphere.svelte';
	import { SimulationResults } from '$lib/stores';

	export let qubit: number;

	$: fallback = { qubit, x: 0, y: 0, z: 1, magnitude: 1 };
	$: vector = $SimulationResults.blochVectors?.find((v) => v.qubit === qubit) ?? fallback;
</script>

<div class="wire-bloch">
	<BlochSphere {vector} label={`q${qubit}`} size={80} showDetails={false} />
</div>

<style>
	.wire-bloch {
		pointer-events: none;
	}
</style>
