<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '@iconify/svelte';
	import LatticePanel from '../../components/Qec/LatticePanel.svelte';
	import { highlightedCheck } from '$lib/qec/stores';
	import { getCheck } from '$lib/qec/layout';
	import { resolvedTheme, toggleTheme } from '$lib/stores/themeStore';

	$: hovered = $highlightedCheck ? getCheck($highlightedCheck) : undefined;
</script>

<svelte:head>
	<title>Surface Code Memory — Feynman Circuits</title>
</svelte:head>

<main
	class="flex min-h-screen flex-col items-center overflow-hidden pb-10"
	style="background: radial-gradient(at center, var(--color-background) 50%, var(--color-surface) 90%)"
>
	<header class="mx-auto flex w-[96%] max-w-420 shrink-0 items-center justify-between">
		<a href={resolve('/')} class="shrink-0">
			<img
				src="/feynman_circuits_logo_dark.svg"
				alt="Feynman Circuits Logo"
				class="logo-light h-16 w-auto cursor-pointer sm:h-20"
			/>
			<img
				src="/feynman_circuits_logo.svg"
				alt="Feynman Circuits Logo"
				class="logo-dark h-16 w-auto cursor-pointer sm:h-20"
			/>
		</a>
		<button
			on:click={toggleTheme}
			aria-label="Toggle theme"
			class="shrink-0 cursor-pointer rounded-full p-2 transition-colors"
		>
			<Icon
				icon={$resolvedTheme === 'dark' ? 'ph:sun-bold' : 'ph:moon-bold'}
				width="22"
				height="22"
				style="color: var(--color-text)"
			/>
		</button>
	</header>

	<div class="mx-auto w-[96%] max-w-420">
		<h1 class="text-xl font-semibold" style="color: var(--color-text)">
			Distance-3 Surface Code Memory
		</h1>
		<p class="mt-1 max-w-2xl text-sm text-muted">
			Nine data qubits hold one logical qubit. Eight ancillas repeatedly measure the stabilisers
			around them — never the data itself, which would destroy the state. Hover a plaquette to see
			which data qubits it checks.
		</p>
	</div>

	<div
		class="mx-auto mt-3 w-[96%] max-w-420 rounded-sm bg-secondary-3/20 p-4 shadow-sm shadow-secondary-2"
	>
		<div class="h-[26rem]">
			<LatticePanel />
		</div>
	</div>

	<!-- Readout: fixed height so the lattice never shifts as the cursor moves. -->
	<div class="mx-auto mt-2 flex h-6 w-[96%] max-w-420 items-center text-sm">
		{#if hovered}
			<span style="color: var(--color-text)">
				<strong>{hovered.id}</strong>
				— {hovered.type}-type stabiliser on data qubits {hovered.dataQubits.join(', ')}.
				{#if hovered.dataQubits.length === 2}
					<span class="text-muted">Weight-2 boundary check.</span>
				{/if}
			</span>
		{:else}
			<span class="text-muted">Hover a plaquette.</span>
		{/if}
	</div>
</main>
