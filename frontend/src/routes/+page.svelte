<script lang="ts">
	import CircuitIE from '../components/CircuitIE.svelte';
	import GatePalette from '../components/GatePalette.svelte';
	import SingleWireDropZone from '../components/SingleWireDropZone.svelte';
	import MultiWireDropZone from '../components/MultiWireDropZone.svelte';
	import SimulationResult from '../components/SimulationResult.svelte';
	import ToggleUI from '../components/ToggleUI.svelte';
	import { circuit } from '$lib/stores';
	import { get } from 'svelte/store';

</script>

<main class="flex min-h-screen flex-col overflow-y-hidden overflow-x-hidden items-center bg-background text-gray-800">
	<div class="flex flex-row my-8">
		<img src="/logo.png" alt="Logo" class="w-20 h-14" />
		<h1 class="mb-6 text-2xl font-bold text-secondary-2">Feynman</h1>
		<h1 class="mb-6 text-2xl font-bold text-primary-1">Circuits</h1>
	</div>

	<!-- Single-Multi-Qubit toggleUI switch -->
	<div class="absolute top-10 right-10">
		<ToggleUI />
	</div>

	<!-- Gate Palette -->
	<GatePalette />

	<!-- Wire/s with Drop Zone -->
	{#if $circuit.mode === 'single'}
		<SingleWireDropZone />
	{:else}
		<MultiWireDropZone />
	{/if}

	<div class="absolute z-10 flex flex-row bottom-5 w-11/12 justify-between">
		<!-- Simulation result -->
		<div class="flex flex-col justify-center border-2 border-ternary-1 rounded-md p-6 w-1/4 ">
			<SimulationResult />
		</div>

		<div class="flex flex-col items-center justify-center">
			<!-- Circuit Import/Export -->
			<CircuitIE />
		</div>
	</div>
</main>
