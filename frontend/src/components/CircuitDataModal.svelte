<script lang="ts">
	import Icon from '@iconify/svelte';
	import type { DataViewMode } from '$lib/circuitDataModal';
	import { fade, scale } from 'svelte/transition';

	export let open = false;
	export let activeView: DataViewMode = 'cir';
	export let value = '';

	export let onClose: () => void;
	export let onTabChange: (mode: DataViewMode) => void;
	export let onCopy: () => void;
	export let onDownload: () => void;
	export let onImport: () => void;

	function focusOnMount(node: HTMLElement) {
		node.focus();
		return {
			destroy() {}
		};
	}
</script>

{#if open}
	<div
		class="fixed inset-0 flex items-center justify-center z-60"
		role="button"
		transition:fade={{ duration: 200 }}
		tabindex="0"
		aria-label="Close circuit data modal"
		on:click={onClose}
		on:keydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') onClose();
		}}
	>
		<div
			class="backdrop-blur-2xl p-4 rounded-sm shadow-sm shadow-ternary-3 max-w-4xl w-[95vw] sm:w-full max-h-[85vh] flex flex-col"
			style="background-color: var(--color-surface);"
			role="dialog"
			aria-modal="true"
			tabindex="0"
			transition:scale={{ duration: 200, start: 0.8 }}
			use:focusOnMount
			on:click|stopPropagation
			on:keydown={(e) => {
				if (e.key === 'Escape') onClose();
			}}
		>
			<div class="flex items-center justify-between mb-3">
				<div class="flex items-center gap-2">
					<button
						type="button"
						on:click={() => onTabChange('cir')}
						class:!bg-ternary-2={activeView === 'cir'}
						class:!text-white={activeView === 'cir'}
						class:!border-ternary-2={activeView === 'cir'}
						class="rounded-sm px-3 py-1.5 text-sm border border-secondary-2 bg-white text-secondary-2 cursor-pointer"
					>
						Canonical IR
					</button>
					<button
						type="button"
						on:click={() => onTabChange('qasm')}
						class:!bg-ternary-2={activeView === 'qasm'}
						class:!text-white={activeView === 'qasm'}
						class:!border-ternary-2={activeView === 'qasm'}
						class="rounded-sm px-3 py-1.5 text-sm border border-secondary-2 bg-white text-secondary-2 cursor-pointer"
					>
						OpenQASM
					</button>
				</div>

				<div class="flex items-center gap-2" style="color: var(--color-text)">
					<div class="flex flex-col justify-center items-center">
						<button type="button" on:click={onCopy} class="rounded-sm text-sm">
							<Icon
								icon="solar:copy-bold"
								width="24"
								height="24"
								class="active:text-green-400 cursor-pointer"
							/>
						</button>
						<span class="font-medium text-[11px]">Copy</span>
					</div>
					<div class="flex flex-col justify-center items-center">
						<button type="button" on:click={onDownload} class="rounded-sm text-sm">
							<Icon
								icon="mingcute:download-fill"
								width="24"
								height="24"
								class="active:text-green-400 cursor-pointer"
							/>
						</button>
						<span class="font-medium text-[11px]">Download</span>
					</div>
					<div class="flex flex-col">
						<button type="button" on:click={onImport} class="rounded-sm text-sm">
							<Icon
								icon="mdi:file-import"
								width="24"
								height="24"
								class="active:text-green-400 cursor-pointer"
							/>
						</button>
						<span class="font-medium text-[11px]">Import</span>
					</div>
					<button type="button" aria-label="Close dialog" on:click={onClose} class="mb-3">
						<Icon
							icon="material-symbols:close"
							class="text-red-500 cursor-pointer"
							width="28"
							height="28"
						/>
					</button>
				</div>
			</div>

			<textarea
				bind:value
				style="color: var(--color-text); background-color: var(--color-background);"
				class="rounded-sm shadow-ternary-2 shadow-sm w-full h-[60vh] p-3 resize-none active:outline-none focus:outline-none"
			></textarea>
		</div>
	</div>
{/if}
