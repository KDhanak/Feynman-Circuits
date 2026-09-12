<script lang="ts">
	import Icon from '@iconify/svelte';
	import { fade, scale } from 'svelte/transition';
	import type { ResolvedHandoff } from '$lib/circuit/handoff';

	// The circuit another platform is offering, or null when there is nothing to
	// confirm. We wait until the user accepts, because opening it without asking
	// would throw away whatever is already on their board.
	export let handoff: ResolvedHandoff | null = null;
	export let error: string | null = null;
	export let onConfirm: () => void;
	export let onCancel: () => void;

	$: gateCount = handoff?.ir.operations.length ?? 0;
	$: qubitCount = handoff?.ir.registers.q ?? 0;
</script>

{#if handoff || error}
	<div
		class="fixed inset-0 z-100 flex items-center justify-center"
		transition:fade={{ duration: 200 }}
	>
		<div
			class="w-[90vw] max-w-sm rounded-sm p-5 shadow-sm shadow-ternary-3 backdrop-blur-2xl"
			style="background-color: var(--color-surface);"
			role="dialog"
			aria-modal="true"
			tabindex="0"
			transition:scale={{ duration: 200, start: 0.85 }}
		>
			<div class="mb-3 flex items-center justify-between gap-2">
				<h2 class="text-lg font-semibold" style="color: var(--color-text);">
					{error ? "Couldn't open that circuit" : 'Open this circuit?'}
				</h2>
				<button type="button" aria-label="Close dialog" on:click={onCancel}>
					<Icon
						icon="material-symbols:close"
						width="24"
						height="24"
						class="text-red-500 cursor-pointer"
					/>
				</button>
			</div>

			{#if error}
				<p class="text-sm" style="color: var(--color-muted);">{error}</p>
				<div class="mt-5 flex justify-end">
					<button type="button" class="btn-primary" on:click={onCancel}>Close</button>
				</div>
			{:else if handoff}
				<p class="text-sm" style="color: var(--color-muted);">Someone shared a circuit with you.</p>

				<div class="mt-3 rounded-sm p-3" style="background-color: var(--color-background);">
					<p class="truncate font-semibold" style="color: var(--color-text);">{handoff.name}</p>
					<p class="mt-1 text-xs" style="color: var(--color-muted);">
						{qubitCount}
						{qubitCount === 1 ? 'qubit' : 'qubits'} · {gateCount}
						{gateCount === 1 ? 'operation' : 'operations'}
					</p>
				</div>

				<p class="mt-3 text-xs" style="color: var(--color-muted);">
					This replaces the circuit currently on your board.
				</p>

				<div class="mt-5 flex justify-end gap-2">
					<button type="button" class="btn-secondary" on:click={onCancel}>Cancel</button>
					<button type="button" class="btn-primary" on:click={onConfirm}>Open circuit</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
