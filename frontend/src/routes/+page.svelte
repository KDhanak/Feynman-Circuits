<script lang="ts">
	import { circuit, SimulationResults, type CircuitState, type GateType } from '../lib/stores';
	import CircuitIE from '../components/CircuitIE.svelte';
	import GatePalette from '../components/GatePalette.svelte';
	import WireDropZone from '../components/WireDropZone.svelte';
	import SimulationResult from '../components/SimulationResult.svelte';

	const gates: { type: GateType; name: string }[] = [
		{ type: 'X', name: 'X Gate' },
		{ type: 'Y', name: 'Y Gate' },
		{ type: 'Z', name: 'Z Gate' },
		{ type: 'H', name: 'H Gate' },
		{ type: 'S', name: 'S Gate' },
		{ type: 'T', name: 'T Gate' }
	];
</script>

<main class="flex min-h-screen flex-col items-center bg-background text-gray-800">
	<div class="flex flex-row mt-10">
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

<style>
	.select-none {
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
		user-select: none;
	}
</style>
