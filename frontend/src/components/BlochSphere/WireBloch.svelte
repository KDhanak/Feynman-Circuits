<script lang="ts">
	import BlochSphere from './BlochSphere.svelte';
	import { simulationResult } from '$lib/IR/stores';

	export let qubit: number;

	$: fallback = { qubit, x: 0, y: 0, z: 1, magnitude: 1 };
	$: vector = $simulationResult.blochVectors?.find((v) => v.qubit === qubit) ?? fallback;
</script>

<div class="pointer-events-none">
	<BlochSphere {vector} size={80} showDetails={false} />
</div>
