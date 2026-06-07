<script lang="ts">
	import Icon from '@iconify/svelte';
	import type { DataViewMode, OpenQasmVersion } from '$lib/circuit/circuitDataModal';
	import { fade, scale } from 'svelte/transition';

	export let open = false;
	export let activeView: DataViewMode = 'cir';
	export let value = '';
	export let qasmVersion: OpenQasmVersion = '3.0';

	export let onClose: () => void;
	export let onTabChange: (mode: DataViewMode) => void;
	export let onVersionChange: (version: OpenQasmVersion) => void;
	export let onCopy: () => void;
	export let onDownload: () => void;
	export let onImport: () => void;

	let showVersionMenu = false;
	let textareaElement: HTMLTextAreaElement;
	let lineCount = 1;

	function handleQasmClick() {
		onTabChange('qasm');
	}

	function toggleVersionMenu() {
		showVersionMenu = !showVersionMenu;
	}

	function handleVersionSelect(version: OpenQasmVersion) {
		qasmVersion = version;
		onVersionChange(version);
		showVersionMenu = false;
	}

	function focusOnMount(node: HTMLElement) {
		node.focus();
		return {
			destroy() {}
		};
	}

	function updateLineCount() {
		lineCount = (value.match(/\n/g) || []).length + 1;
	}

	$: value, updateLineCount();

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		const menu = document.querySelector('[role="menu"]');
		const dropdownContainer = menu?.closest('.relative.inline-flex');

		if (showVersionMenu && menu && !dropdownContainer?.contains(target)) {
			showVersionMenu = false;
		}
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
			on:click={(e) => {
				const target = e.target as HTMLElement;
				// Close version menu if clicking outside the dropdown container
				if (showVersionMenu && !target.closest('.relative.inline-flex')) {
					showVersionMenu = false;
				}
				e.stopPropagation();
			}}
			on:keydown={(e) => {
				if (e.key === 'Escape') onClose();
			}}
		>
			<!-- Tab buttons and version selector -->
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
					<div class="relative inline-flex">
						<button
							type="button"
							on:click={handleQasmClick}
							class:!bg-ternary-2={activeView === 'qasm'}
							class:!text-white={activeView === 'qasm'}
							class:!border-ternary-2={activeView === 'qasm'}
							class="rounded-l-sm px-3 py-1.5 text-sm border border-secondary-2 bg-white text-secondary-2 cursor-pointer flex-1"
						>
							OpenQASM {qasmVersion}
						</button>
						<button
							type="button"
							on:click={toggleVersionMenu}
							disabled={activeView !== 'qasm'}
							class:!bg-ternary-2={activeView === 'qasm'}
							class:!text-white={activeView === 'qasm'}
							class:!border-l-white={activeView === 'qasm'}
							class="rounded-r-sm px-2 py-1.5 text-sm border-l border-secondary-2 bg-white text-secondary-2 cursor-pointer hover:bg-secondary-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							<span class="transition-transform inline-block" class:rotate-180={showVersionMenu}>▼</span>
						</button>

						{#if activeView === 'qasm' && showVersionMenu}
							<div
								class="absolute top-full mt-1 left-0 right-0 rounded-sm z-50 shadow-sm"
								style="background-color: var(--color-surface);"
								role="menu"
								tabindex="-1"
								transition:fade={{ duration: 150 }}
								on:keydown={(e) => {
									if (e.key === 'Escape') {
										showVersionMenu = false;
										e.preventDefault();
									}
								}}
							>
								<button
									type="button"
									role="menuitem"
									on:click={() => handleVersionSelect('3.0')}
									class="btn-highlight-item rounded-t-sm w-full"
									class:opacity-100={qasmVersion === '3.0'}
									class:opacity-75={qasmVersion !== '3.0'}
								>
									OpenQASM 3.0
								</button>
								<button
									type="button"
									role="menuitem"
									on:click={() => handleVersionSelect('2.0')}
									class="btn-highlight-item rounded-b-sm w-full"
									class:opacity-100={qasmVersion === '2.0'}
									class:opacity-75={qasmVersion !== '2.0'}
								>
									OpenQASM 2.0
								</button>
							</div>
						{/if}
					</div>
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

			<!-- Editor with Line Numbers -->
			<div class="editor-wrapper">
				<div class="line-numbers">
					{#each Array(lineCount) as _, i}
						<div class="line-number">{i + 1}</div>
					{/each}
				</div>
				<textarea
					bind:this={textareaElement}
					bind:value
					style="color: var(--color-text); background-color: var(--color-background);"
					class="code-textarea"
					on:keydown|stopPropagation
				></textarea>
			</div>
		</div>
	</div>
{/if}

<style>
	.editor-wrapper {
		display: flex;
		width: 100%;
		height: 60vh;
		border: 1px solid var(--color-border);
		border-radius: 0.125rem;
		overflow: hidden;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.line-numbers {
		display: flex;
		flex-direction: column;
		background-color: var(--color-surface);
		border-right: 1px solid var(--color-border);
		padding: 0;
		user-select: none;
		overflow: hidden;
		min-width: 50px;
		text-align: right;
	}

	.line-number {
		padding: 0 8px;
		height: 1.5em;
		line-height: 1.5em;
		color: var(--color-muted);
		font-family: 'Courier New', monospace;
		font-size: 13px;
		flex-shrink: 0;
	}

	.code-textarea {
		flex: 1;
		border: none;
		outline: none;
		padding: 8px 12px;
		font-family: 'Courier New', monospace;
		font-size: 13px;
		line-height: 1.5;
		resize: none;
		overflow: auto;
	}
</style>
