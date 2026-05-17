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

<main class="flex min-h-screen flex-col overflow-x-hidden items-center bg-[radial-gradient(at_center,#020618_50%,#09090b_90%)]">

	<!-- Header -->
	<header class="relative w-full flex items-center justify-between px-4 sm:px-7 py-2 shrink-0">
		<a href="/" class="shrink-0">
			<img src="/feynman_circuits_logo.svg" alt="Feynman Circuits Logo" class="h-16 sm:h-20 w-auto cursor-pointer" />
		</a>

		<div class="hidden sm:flex flex-row">
			<h1 class="mb-4 text-xl font-semibold text-secondary-2">FEYNMAN</h1>
			<span class="mb-4 text-xl font-semibold text-white">CIRCUITS</span>
		</div>

		<div class="shrink-0">
			<SignUp_In />
		</div>
	</header>

	<!-- Gate Palette -->
	<GatePalette />

	<!-- Circuit board -->
	<CircuitLayout />

	<!-- Results row — normal page flow, responsive -->
	<div class="w-[96%] mx-auto mt-4 mb-6 flex flex-col sm:flex-row justify-between items-end gap-4">
		<SimulationResult />
		<div class="shrink-0">
			<OverallBlochSphere />
		</div>
	</div>

</main>
