<script lang="ts">
	import GatePalette from '../components/GatePalette.svelte';
	import SimulationResult from '../components/SimulationResult.svelte';
	import SignUp_In from '../components/SidePanel/AuthPanel.svelte';
	import { onMount } from 'svelte';
	import { loadSession } from '$lib/auth/session';
	import { theme, toggleTheme } from '$lib/stores/themeStore';
	import OverallBlochSphere from '../components/BlochSphere/OverallBlochSphere.svelte';
	import CircuitLayout from '../components/CircuitLayout/CircuitLayout.svelte';
	import Icon from '@iconify/svelte';
	import { currentCircuitId, currentCircuitName } from '$lib/IR/stores';
	import '$lib/circuit/autoSave';

	const circuit_id = crypto.randomUUID();
	currentCircuitId.set(circuit_id);
	currentCircuitName.set('Untitled Circuit');

	onMount(() => {
		loadSession();
	});
</script>

<main
	class="flex min-h-screen flex-col overflow-x-hidden items-center"
	style="background: radial-gradient(at center, var(--color-background) 50%, var(--color-surface) 90%)"
>
	<!-- Header -->
	<header class="relative w-full flex items-center justify-between px-4 sm:px-7 py-2 shrink-0">
		<a href="/" class="shrink-0">
			<img
				src={$theme === 'dark' ? '/feynman_circuits_logo.svg' : '/feynman_circuits_logo_dark.svg'}
				alt="Feynman Circuits Logo"
				class="h-16 sm:h-20 w-auto cursor-pointer"
			/>
		</a>

		<div class="hidden sm:flex flex-row">
			<h1 class="mb-4 text-xl font-semibold text-secondary-2">FEYNMAN</h1>
			<span class="mb-4 text-xl font-semibold" style="color: var(--color-text);">CIRCUITS</span>
		</div>

		<div class="flex items-center gap-2">
			<button
				on:click={toggleTheme}
				aria-label="Toggle theme"
				class="shrink-0 p-2 rounded-full cursor-pointer transition-colors"
			>
				<Icon
					icon={$theme === 'dark' ? 'ph:sun-bold' : 'ph:moon-bold'}
					width="22"
					height="22"
					style="color: var(--color-text)"
				/>
			</button>

			<div class="shrink-0">
				<SignUp_In />
			</div>
		</div>
	</header>

	<!-- Gate Palette -->
	<GatePalette />

	<!-- Circuit board -->
	<div class="shadow-sm shadow-ternary-1 bg-ternary-3/20 w-[96%]">
		<CircuitLayout />
	</div>
	<!-- Results row — normal page flow, responsive -->
	<div class="w-[96%] mx-auto mt-4 mb-6 flex flex-col sm:flex-row justify-between items-end gap-4">
		<div class="flex-1 shadow-sm shadow-secondary-2 bg-secondary-3/20 rounded-sm p-4 max-w-1/5">
			<SimulationResult />
		</div>
		<div class="shrink-0 shadow-sm shadow-secondary-2 bg-secondary-3/20 rounded-sm p-4">
			<OverallBlochSphere />
		</div>
	</div>
</main>
