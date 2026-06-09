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
	import { session } from '$lib/auth/session';
	import { saveStatus, notification } from '$lib/stores/uiStores';
	import '$lib/circuit/autoSave';
	import { get } from 'svelte/store';

	// Only initialize on first load — stores survive HMR so skip re-init
	if (!get(currentCircuitId)) {
		currentCircuitId.set(crypto.randomUUID());
		currentCircuitName.set('Untitled Circuit');
	}

	onMount(() => {
		loadSession();
	});
</script>

<main
	class="flex h-screen flex-col overflow-hidden items-center"
	style="background: radial-gradient(at center, var(--color-background) 50%, var(--color-surface) 90%)"
>
	<!-- Header -->
	<header class="relative w-full flex items-center justify-between px-4 sm:px-7 py-2 shrink-0">
		<a href="/" class="shrink-0">
			<img
				src="/feynman_circuits_logo_dark.svg"
				alt="Feynman Circuits Logo"
				class="logo-light h-16 sm:h-20 w-auto cursor-pointer"
			/>
			<img
				src="/feynman_circuits_logo.svg"
				alt="Feynman Circuits Logo"
				class="logo-dark h-16 sm:h-20 w-auto cursor-pointer"
			/>
		</a>

		<div class="hidden sm:flex flex-row">
			<h1 class="mb-4 text-xl font-semibold text-secondary-2">FEYNMAN</h1>
			<span class="mb-4 text-xl font-semibold" style="color: var(--color-text);">CIRCUITS</span>
		</div>

		<div class="flex items-center gap-2">
			<div
				class="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-sm"
				class:invisible={$session.status !== 'authenticated'}
				style="color: var(--color-muted);"
			>
				<Icon icon="ph:circuit-board" width="15" height="15" />
				<span class="w-3.25 h-3.25 shrink-0 flex items-center justify-center">
					{#if $saveStatus === 'saving'}
						<Icon icon="svg-spinners:ring-resize" width="13" height="13" style="color: var(--color-measured);" />
					{:else if $saveStatus === 'saved'}
						<Icon icon="ph:check-bold" width="13" height="13" class="text-green-500" />
					{/if}
				</span>
				<span class="text-sm font-semibold max-w-40 truncate">{$currentCircuitName}</span>
			</div>

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

	<!-- Circuit board — fills all remaining vertical space -->
	<div class="shadow-sm shadow-ternary-1 bg-ternary-3/20 w-[96%] flex-1 min-h-0 overflow-hidden">
		<CircuitLayout />
	</div>
	<!-- Results row — fixed at bottom, never scrolls -->
	<div class="w-[96%] mx-auto mt-4 mb-6 flex flex-col sm:flex-row justify-between items-stretch gap-4 shrink-0">
		<div class="flex-1 shadow-sm shadow-secondary-2 bg-secondary-3/20 rounded-sm p-4 max-w-sm overflow-y-auto">
			<SimulationResult />
		</div>
		<div class="shrink-0 shadow-sm shadow-secondary-2 bg-secondary-3/20 rounded-sm p-4">
			<OverallBlochSphere />
		</div>
	</div>
</main>

{#if $notification}
	<div
		class="fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-sm shadow-lg z-300 text-sm flex items-center gap-2 text-white {$notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}"
	>
		<Icon
			icon={$notification.type === 'success' ? 'material-symbols:check-circle' : 'material-symbols:error'}
			width="18"
			height="18"
		/>
		{$notification.message}
	</div>
{/if}
