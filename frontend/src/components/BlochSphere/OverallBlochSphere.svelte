<script lang="ts">
	import BlochSphere from './BlochSphere.svelte';
	import { simulationResult } from '$lib/IR/stores';
	import { computeOverallBlochVector } from '$lib/quantum/bloch';
	import { onMount } from 'svelte';

	$: overall = computeOverallBlochVector($simulationResult.blochVectors ?? []);

	let sphereSize = 250;

	onMount(() => {
		const update = () => { sphereSize = window.innerWidth < 640 ? 140 : 250; };
		update();
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	});
</script>

<div>
	<BlochSphere vector={overall} size={sphereSize} showAxisLabels={true} />
</div>
