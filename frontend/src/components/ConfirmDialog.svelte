<script lang="ts">
	import Icon from '@iconify/svelte';
	import { fade, scale } from 'svelte/transition';

	export let open = false;
	export let title = 'Are you sure?';
	export let message = '';
	export let confirmLabel = 'Confirm';
	export let danger = false;
	export let onConfirm: () => void;
	export let onCancel: () => void;
</script>

{#if open}
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
				<h2 class="text-lg font-semibold" style="color: var(--color-text);">{title}</h2>
				<button type="button" aria-label="Close dialog" on:click={onCancel}>
					<Icon
						icon="material-symbols:close"
						width="24"
						height="24"
						class="text-red-500 cursor-pointer"
					/>
				</button>
			</div>

			{#if message}
				<p class="text-sm" style="color: var(--color-muted);">{message}</p>
			{/if}

			<div class="mt-5 flex justify-end gap-2">
				<button type="button" class="btn-secondary" on:click={onCancel}>Cancel</button>
				<button
					type="button"
					class={danger
						? 'rounded-sm bg-red-500 px-4 py-2 font-semibold text-white shadow active:bg-red-600 cursor-pointer'
						: 'btn-primary'}
					on:click={onConfirm}
				>
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
