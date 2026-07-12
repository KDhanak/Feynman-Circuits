<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import {
		listCircuits,
		loadCircuit,
		deleteCircuit,
		renameCircuit as renameCircuitApi,
		type CircuitSummary
	} from '$lib/api/circuitApi';
	import { currentCircuitId, currentCircuitName } from '$lib/IR/stores';
	import { triggerSimulation } from '$lib/circuit/dragDropUtils';
	import { markNameResolved, isCircuitSaved } from '$lib/circuit/autoSave';
	import { showNotification } from '$lib/utils/notificationUtils';
	import { downloadCircuit, copyToClipboard } from '$lib/circuit/circuitActions';
	import { buildCanonicalString } from '$lib/circuit/circuitDataModal';
	import NameDialog from '../NameDialog.svelte';
	import { circuitIR } from '$lib/IR/stores';
	import { get } from 'svelte/store';
	import { tick } from 'svelte';

	export let onClose: () => void;

	let circuits: CircuitSummary[] = [];
	let loading = true;
	let loadingMore = false;
	let page = 1;
	let hasMore = false;
	let deletingId = '';

	let contextMenuVisible = false;
	let contextMenuX = 0;
	let contextMenuY = 0;
	let contextMenuCircuit: CircuitSummary | null = null;

	async function fetchCircuits() {
		try {
			const { results, next } = await listCircuits(1);
			circuits = results;
			page = 1;
			hasMore = next !== null;
		} catch {
			showNotification('Failed to load circuits.', 'error');
		} finally {
			loading = false;
		}
	}

	async function loadMore() {
		if (loadingMore || !hasMore) return;
		loadingMore = true;
		try {
			const { results, next } = await listCircuits(page + 1);
			circuits = [...circuits, ...results];
			page += 1;
			hasMore = next !== null;
		} catch {
			showNotification('Failed to load more circuits.', 'error');
		} finally {
			loadingMore = false;
		}
	}

	onMount(() => {
		fetchCircuits();

		const handleClickOutside = (e: MouseEvent) => {
			const menu = document.querySelector('.circuit-context-menu');
			if (contextMenuVisible && menu && !menu.contains(e.target as HTMLElement)) {
				closeContextMenu();
			}
		};
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});

	function handleContextMenu(circuit: CircuitSummary, e: MouseEvent) {
		e.preventDefault();
		contextMenuCircuit = circuit;
		contextMenuX = e.clientX;
		contextMenuY = e.clientY;
		contextMenuVisible = true;
	}

	function closeContextMenu() {
		contextMenuVisible = false;
		contextMenuCircuit = null;
	}

	async function openCircuit(circuit: CircuitSummary) {
		closeContextMenu();
		try {
			const ir = await loadCircuit(circuit.circuit_id);
			circuitIR.set(ir);
			currentCircuitId.set(circuit.circuit_id);
			currentCircuitName.set(circuit.name);
			markNameResolved();
			isCircuitSaved.set(true);
			triggerSimulation(ir);
			showNotification(`"${circuit.name}" loaded.`, 'success');
			onClose();
		} catch {
			showNotification('Failed to load circuit.', 'error');
		}
	}

	let renameTarget: CircuitSummary | null = null;

	function renameCircuit(circuit: CircuitSummary) {
		closeContextMenu();
		renameTarget = circuit;
	}

	async function confirmRename(newName: string) {
		const circuit = renameTarget;
		renameTarget = null;
		if (!circuit) return;
		try {
			await renameCircuitApi(circuit.circuit_id, newName);
			circuits = circuits.map((c) =>
				c.circuit_id === circuit.circuit_id ? { ...c, name: newName } : c
			);
			if (circuit.circuit_id === get(currentCircuitId)) {
				currentCircuitName.set(newName);
			}
			showNotification('Circuit renamed!', 'success');
		} catch (err: unknown) {
			const apiMessage =
				(err as { response?: { data?: { name?: string[] } } })?.response?.data?.name?.[0];
			showNotification(apiMessage ?? 'Failed to rename circuit.', 'error');
		}
	}

	async function handleCopy(circuit: CircuitSummary) {
		closeContextMenu();
		try {
			const ir = circuit.circuit_id === get(currentCircuitId)
				? get(circuitIR)
				: await loadCircuit(circuit.circuit_id);
			await copyToClipboard(buildCanonicalString(ir));
		} catch {
			showNotification('Failed to copy circuit.', 'error');
		}
	}

	async function handleDownload(circuit: CircuitSummary) {
		closeContextMenu();
		try {
			const ir = circuit.circuit_id === get(currentCircuitId)
				? get(circuitIR)
				: await loadCircuit(circuit.circuit_id);
			downloadCircuit(circuit.name, ir);
		} catch {
			showNotification('Failed to download circuit.', 'error');
		}
	}

	async function handleDelete(circuit: CircuitSummary) {
		closeContextMenu();
		deletingId = circuit.circuit_id;
		try {
			await deleteCircuit(circuit.circuit_id);
			circuits = circuits.filter((c) => c.circuit_id !== circuit.circuit_id);
			showNotification(`"${circuit.name}" deleted.`, 'success');
		} catch {
			showNotification('Failed to delete circuit.', 'error');
		} finally {
			deletingId = '';
		}
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	async function handleClose() {
		closeContextMenu();
		await tick();
		onClose();
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) handleClose();
	}
</script>

<div
	class="fixed inset-0 z-100"
	style="background-color: rgba(0,0,0,0.3); backdrop-filter: blur(4px);"
	role="button"
	tabindex="0"
	aria-label="Close circuits panel"
	on:click={handleBackdropClick}
	on:keydown={(e) => e.key === 'Escape' && handleClose()}
	transition:fade={{ duration: 300 }}
>
	<aside
		class="absolute right-0 top-0 h-full w-full sm:max-w-md border-l border-t border-b rounded-sm shadow-2xl flex flex-col"
		style="background-color: var(--color-surface); border-color: var(--color-text);"
		transition:fly={{ x: 400, duration: 300 }}
	>
		<!-- Header -->
		<div
			class="flex items-center justify-between px-6 py-4 shrink-0"
			style="border-bottom: 1px solid var(--color-border);"
		>
			<h2 class="text-lg font-semibold" style="color: var(--color-text);">My Circuits</h2>
			<button type="button" aria-label="Close" on:click={handleClose}>
				<Icon
					icon="material-symbols:close"
					class="cursor-pointer text-red-500"
					width="24"
					height="24"
				/>
			</button>
		</div>

		<!-- Body -->
		<div class="flex-1 overflow-y-auto px-4 py-4">
			{#if loading}
				<div class="flex items-center justify-center h-40">
					<Icon
						icon="svg-spinners:ring-resize"
						width="32"
						height="32"
						style="color: var(--color-measured);"
					/>
				</div>
			{:else if circuits.length === 0}
				<div class="flex flex-col items-center justify-center h-40 gap-2">
					<Icon
						icon="ph:circuit-board-bold"
						width="40"
						height="40"
						style="color: var(--color-muted);"
					/>
					<p class="text-sm" style="color: var(--color-muted);">No saved circuits yet.</p>
				</div>
			{:else}
				<ul class="flex flex-col gap-2">
					{#each circuits as circuit (circuit.circuit_id)}
						<li>
							<div
								class="w-full text-left px-4 py-3 rounded-sm shadow-sm shadow-measured/40 hover:shadow-measured transition-shadow duration-200 flex items-center justify-between gap-3 cursor-pointer"
								style="background-color: var(--color-surface);"
								role="button"
								tabindex="0"
								on:click={() => openCircuit(circuit)}
								on:keydown={(e) => e.key === 'Enter' && openCircuit(circuit)}
								on:contextmenu={(e) => handleContextMenu(circuit, e)}
							>
								<div class="flex flex-col gap-1 min-w-0">
									<div class="flex items-center gap-2 min-w-0">
										<span class="text-sm font-semibold truncate" style="color: var(--color-text);">
											{circuit.name}
										</span>
										{#if circuit.circuit_id === $currentCircuitId}
											<span
												class="shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700"
											>
												Active
											</span>
										{/if}
									</div>
									<span class="text-xs" style="color: var(--color-muted);">
										{formatDate(circuit.updated_at)}
									</span>
								</div>

								{#if deletingId === circuit.circuit_id}
									<Icon
										icon="svg-spinners:ring-resize"
										width="18"
										height="18"
										style="color: var(--color-measured);"
									/>
								{/if}
							</div>
						</li>
					{/each}
				</ul>

				{#if hasMore}
					<button
						type="button"
						class="mt-3 w-full py-2 rounded-sm text-sm font-medium border transition-colors disabled:opacity-60 disabled:cursor-default flex items-center justify-center gap-2 cursor-pointer"
						style="border-color: var(--color-border); color: var(--color-text);"
						on:click={loadMore}
						disabled={loadingMore}
					>
						{#if loadingMore}
							<Icon icon="svg-spinners:ring-resize" width="16" height="16" />
							Loading…
						{:else}
							Load more
						{/if}
					</button>
				{/if}
			{/if}
		</div>
	</aside>
</div>

<!-- Context menu rendered at root level so it's never clipped by the aside -->
{#if contextMenuVisible && contextMenuCircuit}
	<div
		class="circuit-context-menu ctx-menu z-200"
		style="left: {contextMenuX}px; top: {contextMenuY}px;"
		role="menu"
		tabindex="0"
		on:click|stopPropagation={() => {}}
		on:keydown={(e) => e.key === 'Escape' && closeContextMenu()}
	>
		<button
			class="ctx-menu-item rounded-t-sm"
			role="menuitem"
			on:click={() => openCircuit(contextMenuCircuit!)}
		>
			<Icon icon="ph:folder-open" width="16" height="16" />
			Load
		</button>
		<button
			class="ctx-menu-item"
			role="menuitem"
			on:click={() => renameCircuit(contextMenuCircuit!)}
		>
			<Icon icon="bx:rename" width="16" height="16" />
			Rename
		</button>
		<button
			class="ctx-menu-item"
			role="menuitem"
			on:click={() => handleCopy(contextMenuCircuit!)}
		>
			<Icon icon="solar:copy-bold" width="16" height="16" />
			Copy Circuit
		</button>
		<button
			class="ctx-menu-item"
			role="menuitem"
			on:click={() => handleDownload(contextMenuCircuit!)}
		>
			<Icon icon="mingcute:download-fill" width="16" height="16" />
			Download
		</button>
		<button
			class="ctx-menu-item-danger rounded-b-sm"
			role="menuitem"
			on:click={() => handleDelete(contextMenuCircuit!)}
		>
			<Icon icon="material-symbols:delete-outline" width="16" height="16" />
			Delete
		</button>
	</div>
{/if}

<NameDialog
	open={renameTarget !== null}
	title="Rename Circuit"
	value={renameTarget?.name ?? ''}
	confirmLabel="Rename"
	onConfirm={confirmRename}
	onCancel={() => (renameTarget = null)}
/>
