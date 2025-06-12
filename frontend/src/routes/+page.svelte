<script lang="ts">
	import CircuitIE from '../components/CircuitIE.svelte';
	import GatePalette from '../components/GatePalette.svelte';
	import WireDropZone from '../components/WireDropZone.svelte';
	import SimulationResult from '../components/SimulationResult.svelte';
</script>

<main class="flex min-h-screen flex-col items-center bg-background text-gray-800">
	<div class="flex flex-row my-8">
		<img src="/logo.png" alt="Logo" class="w-20 h-14"/>
		<h1 class="mb-6 text-2xl font-bold text-secondary-2">Feynman</h1>
		<h1 class="mb-6 text-2xl font-bold text-primary-1">Circuits</h1>
	</div>

	<!-- Gate Palette -->
	<GatePalette />

	<!-- Wire with Drop Zone -->
	<WireDropZone />

	<!-- Simulation result -->
	<SimulationResult />

	<!-- Circuit Import/Export -->
	<CircuitIE />
</main>
