<script lang="ts">
	import Icon from '@iconify/svelte';
	import { fade, scale } from 'svelte/transition';

	export let open = false;
	export let title = 'Name Circuit';
	export let value = '';
	export let confirmLabel = 'Save';
	export let onConfirm: (name: string) => void;
	export let onCancel: () => void;

	let name = '';

	// Fill the input with the given value each time the dialog opens.
	$: if (open) name = value;

	$: canConfirm = name.trim().length > 0;

	function confirm() {
		if (!canConfirm) return;
		onConfirm(name.trim());
	}

	function autofocus(node: HTMLInputElement) {
		node.focus();
		node.select();
		return { destroy() {} };
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-60 flex items-center justify-center"
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

			<input
				type="text"
				class="input-field"
				bind:value={name}
				use:autofocus
				placeholder="Circuit name"
				on:keydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						confirm();
					}
				}}
			/>

			<div class="mt-5 flex justify-end gap-2">
				<button type="button" class="btn-secondary" on:click={onCancel}>Cancel</button>
				<button type="button" class="btn-primary" disabled={!canConfirm} on:click={confirm}>
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
