<script lang="ts">
	import CircuitIE from '../components/CircuitIE.svelte';
	import GatePalette from '../components/GatePalette.svelte';
	import SingleWireDropZone from '../components/SingleWireDropZone.svelte';
	import MultiWireDropZone from '../components/MultiWireDropZone.svelte';
	import SimulationResult from '../components/SimulationResult.svelte';
	import ToggleUI from '../components/ToggleUI.svelte';
	import SignUp_In from '../components/SignUp_In.svelte';
	import { circuit } from '$lib/stores';
	import { onMount } from 'svelte';
	import { loadSession } from '$lib/session';
	import OverallBlochSphere from '../components/BlochSphere/OverallBlochSphere.svelte';

	onMount(() => {
		loadSession();
	});
</script>

<main
	class="flex min-h-screen flex-col overflow-y-hidden overflow-x-hidden items-center bg-gray-900 text-gray-800"
>
	<div class="relative w-full flex items-center justify-center">
		<!-- Single-Multi-Qubit toggleUI switch -->
		<div class="absolute top-10 left-10">
			<ToggleUI />
		</div>
		<div class="flex flex-row my-4">
			<img src="/logo.png" alt="Logo" class="w-20 h-14" />
			<h1 class="mb-6 text-2xl font-bold text-secondary-2">Feynman</h1>
			<h1 class="mb-6 text-2xl font-bold text-white">Circuits</h1>
		</div>
		<div class="absolute top-10 right-10">
			<SignUp_In />
		</div>
	</div>
	<!-- Gate Palette -->
	<GatePalette />

	<!-- Wire/s with Drop Zone -->
	{#if $circuit.mode === 'single'}
		<SingleWireDropZone />
	{:else}
		<MultiWireDropZone />
	{/if}

	<div class="absolute z-10 bottom-2 w-11/12 grid grid-cols-[1fr_auto_1fr] items-end">
		<div class="justify-self-start flex items-end pb-2">
			<SimulationResult />
		</div>

		<div class="justify-self-center">
			<OverallBlochSphere />
		</div>

		<div class="justify-self-end flex flex-col items-center justify-center">
			<CircuitIE />
		</div>
	</div>
</main>
