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
		class="fixed inset-0 bg-transparent flex items-center justify-center z-60"
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
			class="bg-slate-950 border border-gray-500 p-4 rounded-sm shadow-md max-w-4xl w-[95vw] sm:w-full max-h-[85vh] flex flex-col"
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
						class:!bg-white={activeView === 'cir'}
						class:!text-secondary-2={activeView === 'cir'}
						class="rounded-sm px-3 py-1.5 text-sm border border-white text-white cursor-pointer"
					>
						Canonical IR
					</button>
				</div>

				<div class="flex items-center gap-2">
					<div class="flex flex-col justify-center items-center">
						<button type="button" on:click={onCopy} class="rounded-sm text-sm text-white">
							<Icon
								icon="solar:copy-bold"
								width="24"
								height="24"
								class="active:text-green-400 cursor-pointer"
							/>
						</button>
						<span class="font-extralight text-gray-300 text-[10px]">Copy</span>
					</div>
					<div class="flex flex-col justify-center items-center">
						<button type="button" on:click={onDownload} class="rounded-sm text-sm text-white">
							<Icon
								icon="mingcute:download-fill"
								width="24"
								height="24"
								class="active:text-green-400 cursor-pointer"
							/>
						</button>
						<span class="font-extralight text-gray-300 text-[10px]">Download</span>
					</div>
					<div class="flex flex-col">
						<button type="button" on:click={onImport} class="rounded-sm text-sm text-white">
							<Icon
								icon="mdi:file-import"
								width="24"
								height="24"
								class="active:text-green-400 cursor-pointer"
							/>
						</button>
						<span class="font-extralight text-gray-300 text-[10px]">Import</span>
					</div>
					<button type="button" aria-label="Close dialog" on:click={onClose}>
						<Icon
							icon="material-symbols:close"
							class="text-ternary-0 cursor-pointer"
							width="24"
							height="24"
						/>
					</button>
				</div>
			</div>

			<textarea
				bind:value
				class="rounded-sm bg-transparent border border-white w-full h-[60vh] text-white p-3 resize-none active:outline-none focus:outline-none"
			></textarea>
		</div>
	</div>
{/if}

