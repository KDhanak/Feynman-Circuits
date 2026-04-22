<script lang="ts">
	import GatePalette from '../components/GatePalette.svelte';
	import SimulationResult from '../components/SimulationResult.svelte';
	import SignUp_In from '../components/SidePanel/AuthPanel.svelte';
	import { onMount } from 'svelte';
	import { loadSession } from '$lib/session';
	import OverallBlochSphere from '../components/BlochSphere/OverallBlochSphere.svelte';
	import CircuitLayout from '../components/CircuitLayout/CircuitLayout.svelte';

	onMount(() => {
		loadSession();
	});
</script>

<main
	class="flex min-h-screen flex-col overflow-y-hidden overflow-x-hidden items-center bg-[radial-gradient(at_center,#020618_50%,#09090b_90%)]"
>
	<div class="relative w-full flex items-center justify-between my-4">
		<div class="flex flex-row mx-10">
			<h1 class="mb-6 text-2xl font-bold text-secondary-2">Feynman</h1>
			<h1 class="mb-6 text-2xl font-bold text-white">Circuits</h1>
		</div>
		<div class="flex flex-row mx-10">
			<SignUp_In />
		</div>
	</div>
	<!-- Gate Palette -->
	<GatePalette />

	<!-- Wire/s with Drop Zone -->
	<CircuitLayout />

	<div class="absolute bottom-2 w-[96%] grid grid-cols-3">
		<div class="justify-self-start mt-auto">
			<SimulationResult />
		</div>

		<div></div>
		<!-- empty center -->

		<div class="justify-self-end mt-auto z-50">
			<OverallBlochSphere />
		</div>
	</div>
</main>
