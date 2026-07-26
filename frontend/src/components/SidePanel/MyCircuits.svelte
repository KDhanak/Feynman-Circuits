<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import {
		listCircuits,
		loadCircuit,
		deleteCircuit,
		renameCircuit as renameCircuitApi,
		fetchAllCircuitIds,
		type CircuitSummary
	} from '$lib/api/circuitApi';
	import { currentCircuitId, currentCircuitName } from '$lib/IR/stores';
	import { triggerSimulation } from '$lib/circuit/dragDropUtils';
	import { markNameResolved, isCircuitSaved } from '$lib/circuit/autoSave';
	import { showNotification } from '$lib/utils/notificationUtils';
	import { downloadCircuit, copyToClipboard } from '$lib/circuit/circuitActions';
	import { buildCanonicalString } from '$lib/circuit/circuitDataModal';
	import NameDialog from '../NameDialog.svelte';
	import ConfirmDialog from '../ConfirmDialog.svelte';
	import { circuitIR } from '$lib/IR/stores';
	import { get } from 'svelte/store';
	import { tick } from 'svelte';
	import {
		circuitListCache,
		setCircuitListCache,
		removeFromCircuitListCache,
		renameInCircuitListCache
	} from '$lib/stores/circuitListCache';

	export let onClose: () => void;

	// Hydrate from the module-level cache so a reopen renders instantly; onMount
	// still revalidates in the background (no spinner when we already have data).
	const cached = get(circuitListCache);

	let circuits: CircuitSummary[] = cached.circuits;
	let total = cached.total;
	let loading = !cached.loaded;
	let loadingMore = false;
	let page = 1;
	let hasMore = cached.hasMore;
	let deletingId = '';

	let contextMenuVisible = false;
	let contextMenuX = 0;
	let contextMenuY = 0;
	let contextMenuCircuit: CircuitSummary | null = null;

	// Multi-select for bulk delete. Reassigned (not mutated) so the list re-renders.
	let selectedIds = new Set<string>();
	let bulkDeleting = false;
	let confirmDeleteOpen = false;
	let selectingAll = false;
	$: selectedCount = selectedIds.size;
	$: allSelected = total > 0 && selectedCount >= total;

	// Any active selection puts the list in "select mode": clicking a row toggles
	// its selection instead of loading the circuit, so a stray click can't open one.
	$: selecting = selectedCount > 0;

	// Select every circuit — including ones on pages not yet loaded — by fetching
	// all ids. Toggles back to a clear when everything is already selected.
	async function toggleSelectAll() {
		if (allSelected) {
			clearSelection();
			return;
		}
		selectingAll = true;
		try {
			const ids = await fetchAllCircuitIds();
			selectedIds = new Set(ids);
		} catch {
			showNotification('Failed to select all circuits.', 'error');
		} finally {
			selectingAll = false;
		}
	}

	function toggleSelect(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function onRowClick(circuit: CircuitSummary) {
		if (selecting) toggleSelect(circuit.circuit_id);
		else openCircuit(circuit);
	}

	function clearSelection() {
		selectedIds = new Set();
	}

	async function deleteSelected() {
		confirmDeleteOpen = false;
		if (selectedCount === 0 || bulkDeleting) return;
		bulkDeleting = true;
		const ids = [...selectedIds];
		const deletedIds: string[] = [];
		let failed = 0;
		for (const id of ids) {
			try {
				await deleteCircuit(id);
				circuits = circuits.filter((c) => c.circuit_id !== id);
				deletedIds.push(id);
			} catch {
				failed++;
			}
		}
		const deleted = deletedIds.length;
		total = Math.max(0, total - deleted);
		removeFromCircuitListCache(deletedIds, deleted);
		selectedIds = new Set();
		bulkDeleting = false;
		if (failed === 0) {
			showNotification(`${deleted} circuit${deleted === 1 ? '' : 's'} deleted.`, 'success');
		} else {
			showNotification(`Deleted ${deleted}, ${failed} failed.`, 'error');
		}
	}

	async function fetchCircuits() {
		try {
			const { results, next, count } = await listCircuits(1);
			circuits = results;
			total = count;
			page = 1;
			hasMore = next !== null;
			setCircuitListCache(results, count, next !== null);
		} catch {
			// Keep any cached list on screen if a background refresh fails.
			if (!get(circuitListCache).loaded) showNotification('Failed to load circuits.', 'error');
		} finally {
			loading = false;
		}
	}

	async function loadMore() {
		if (loadingMore || !hasMore) return;
		loadingMore = true;
		try {
			const { results, next, count } = await listCircuits(page + 1);
			circuits = [...circuits, ...results];
			total = count;
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
			renameInCircuitListCache(circuit.circuit_id, newName);
			if (circuit.circuit_id === get(currentCircuitId)) {
				currentCircuitName.set(newName);
			}
			showNotification('Circuit renamed!', 'success');
		} catch (err: unknown) {
			const apiMessage = (err as { response?: { data?: { name?: string[] } } })?.response?.data
				?.name?.[0];
			showNotification(apiMessage ?? 'Failed to rename circuit.', 'error');
		}
	}

	async function handleCopy(circuit: CircuitSummary) {
		closeContextMenu();
		try {
			const ir =
				circuit.circuit_id === get(currentCircuitId)
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
			const ir =
				circuit.circuit_id === get(currentCircuitId)
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
			total = Math.max(0, total - 1);
			removeFromCircuitListCache([circuit.circuit_id]);
			if (selectedIds.has(circuit.circuit_id)) {
				const next = new Set(selectedIds);
				next.delete(circuit.circuit_id);
				selectedIds = next;
			}
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
	style="background-color: rgba(0,0,0,0.3); backdrop-filter: blur(1px);"
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
			<div class="flex items-center gap-2">
				<h2 class="text-lg font-semibold" style="color: var(--color-text);">My Circuits</h2>
				{#if !loading}
					<span
						class="rounded-full bg-measured/30 shadow px-2 py-0.5 text-xs font-semibold text-measured"
						aria-label={`${total} saved circuits`}
					>
						{total}
					</span>
				{/if}
			</div>
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
				<!-- Select-all toolbar -->
				<div class="mb-2 flex items-center justify-between px-1">
					<button
						type="button"
						class="flex items-center gap-1.5 text-sm font-medium cursor-pointer disabled:opacity-60 disabled:cursor-default"
						style="color: var(--color-secondary-2);"
						on:click={toggleSelectAll}
						disabled={selectingAll || bulkDeleting}
					>
						{#if selectingAll}
							<Icon icon="svg-spinners:ring-resize" width="15" height="15" />
							Selecting…
						{:else}
							<Icon
								icon={allSelected
									? 'material-symbols:check-box'
									: 'material-symbols:check-box-outline-blank'}
								width="18"
								height="18"
							/>
							{allSelected ? 'Deselect all' : `Select all (${total})`}
						{/if}
					</button>
					{#if selectedCount > 0}
						<span class="text-xs" style="color: var(--color-muted);">
							{selectedCount} of {total}
						</span>
					{/if}
				</div>

				<ul class="flex flex-col gap-2">
					{#each circuits as circuit (circuit.circuit_id)}
						<li>
							<div
								class="circuit-row w-full text-left px-4 py-3 rounded-sm shadow-sm shadow-measured/40 hover:shadow-measured transition-shadow duration-200 flex items-center justify-between gap-3 cursor-pointer"
								class:ring-2={selectedIds.has(circuit.circuit_id)}
								class:ring-secondary-2={selectedIds.has(circuit.circuit_id)}
								style="background-color: var(--color-surface);"
								role="button"
								tabindex="0"
								on:click={() => onRowClick(circuit)}
								on:keydown={(e) => e.key === 'Enter' && onRowClick(circuit)}
								on:contextmenu={(e) => handleContextMenu(circuit, e)}
							>
								<div class="flex items-center gap-3 min-w-0">
									<input
										type="checkbox"
										class="select-checkbox shrink-0 cursor-pointer"
										class:reveal={selecting}
										checked={selectedIds.has(circuit.circuit_id)}
										on:click|stopPropagation
										on:change={() => toggleSelect(circuit.circuit_id)}
										aria-label={`Select ${circuit.name}`}
									/>
									<div class="flex flex-col gap-1 min-w-0">
										<div class="flex items-center gap-2 min-w-0">
											<span
												class="text-sm font-semibold truncate"
												style="color: var(--color-text);"
											>
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

		<!-- Bulk-select action bar -->
		{#if selectedCount > 0}
			<div
				class="flex shrink-0 items-center justify-between gap-2 px-4 py-3"
				style="border-top: 1px solid var(--color-border);"
				transition:fly={{ y: 40, duration: 200 }}
			>
				<span class="text-sm font-medium" style="color: var(--color-text);">
					{selectedCount} selected
				</span>
				<div class="flex items-center gap-2">
					<button
						type="button"
						class="rounded-sm px-3 py-1.5 text-sm font-medium cursor-pointer"
						style="color: var(--color-muted);"
						on:click={clearSelection}
						disabled={bulkDeleting}
					>
						Clear
					</button>
					<button
						type="button"
						class="flex items-center gap-1.5 rounded-sm bg-red-500 px-3 py-1.5 text-sm font-semibold text-white shadow active:bg-red-600 disabled:opacity-60 disabled:cursor-default cursor-pointer"
						on:click={() => (confirmDeleteOpen = true)}
						disabled={bulkDeleting}
					>
						{#if bulkDeleting}
							<Icon icon="svg-spinners:ring-resize" width="16" height="16" />
							Deleting…
						{:else}
							<Icon icon="material-symbols:delete-outline" width="16" height="16" />
							Delete {selectedCount}
						{/if}
					</button>
				</div>
			</div>
		{/if}
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
		<button class="ctx-menu-item" role="menuitem" on:click={() => handleCopy(contextMenuCircuit!)}>
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

<ConfirmDialog
	open={confirmDeleteOpen}
	title="Delete circuits"
	message={`Delete ${selectedCount} selected circuit${selectedCount === 1 ? '' : 's'}? This can't be undone.`}
	confirmLabel="Delete"
	danger
	onConfirm={deleteSelected}
	onCancel={() => (confirmDeleteOpen = false)}
/>

<style>
	/* Custom checkbox: transparent background when unselected, brand fill + check
	   when selected (native `accent-color` leaves an opaque white box unchecked). */
	.select-checkbox {
		appearance: none;
		-webkit-appearance: none;
		width: 1rem;
		height: 1rem;
		border: 1.5px solid var(--color-muted);
		border-radius: 0.125rem;
		background-color: transparent;
		display: inline-grid;
		place-content: center;
		transition:
			border-color 0.15s ease,
			background-color 0.15s ease,
			opacity 0.15s ease;
	}

	/* The checkbox is hidden until you hover the row. Once any circuit is
	   selected, `.reveal` keeps every checkbox visible so you can pick more.
	   Hidden checkboxes also ignore clicks so the row opens the circuit. */
	.select-checkbox:not(.reveal) {
		opacity: 0;
		pointer-events: none;
	}
	.circuit-row:hover .select-checkbox,
	.circuit-row:focus-within .select-checkbox {
		opacity: 1;
		pointer-events: auto;
	}
	.select-checkbox::before {
		content: '';
		width: 0.6rem;
		height: 0.6rem;
		transform: scale(0);
		transition: transform 0.1s ease-in-out;
		background-color: #ffffff;
		clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
	}
	.select-checkbox:checked {
		background-color: var(--color-secondary-2);
		border-color: var(--color-secondary-2);
	}
	.select-checkbox:checked::before {
		transform: scale(1);
	}
</style>
