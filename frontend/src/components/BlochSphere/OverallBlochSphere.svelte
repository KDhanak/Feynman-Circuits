<script lang="ts">
	import BlochSphere from './BlochSphere.svelte';
	import { simulationResult } from '$lib/IR/stores';
	import { computeOverallBlochVector } from '$lib/quantum/bloch';
	import { onMount } from 'svelte';

	$: overall = computeOverallBlochVector($simulationResult.blochVectors ?? []);

	let sphereSize = 200;

	onMount(() => {
		const update = () => { sphereSize = window.innerWidth < 768 ? 140 : 200; };
		update();
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	});
</script>

<div class="flex flex-col items-center text-white text-xs tracking-wider font-light">
	<BlochSphere vector={overall} size={sphereSize} showAxisLabels={true} />
</div>
