<script lang="ts">
	import BlochSphere from './BlochSphere.svelte';
	import { simulationResult } from '$lib/IR/stores';
	import { computeOverallBlochVector } from '$lib/quantum/bloch';
	import { onMount } from 'svelte';

	$: vectors = $simulationResult.blochVectors ?? [];
	$: overall = computeOverallBlochVector(vectors);
	// One sphere can only hold one qubit's state, so for multi-qubit circuits
	// this is the mean of the per-qubit vectors — say so rather than implying
	// it is the state of the whole register.
	$: caption =
		vectors.length > 1
			? `Average over ${vectors.length} qubits — not the full ${vectors.length}-qubit state`
			: 'State of qubit 0';

	let sphereSize = 220;

	onMount(() => {
		const update = () => {
			sphereSize = window.innerWidth < 640 ? 140 : 250;
		};
		update();
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	});
</script>

<div class="flex flex-col items-center">
	<BlochSphere vector={overall} size={sphereSize} showAxisLabels={true} />
	<p class="mt-1 max-w-[16rem] text-center text-[0.7rem] leading-tight text-muted">{caption}</p>
</div>
