<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import Loader from '../Loader.svelte';
	import {
		listCircuits,
		loadCircuit,
		deleteCircuit,
		renameCircuit as renameCircuitApi,
		fetchAllCircuitIds,
		setCircuitPublic,
		type CircuitSummary
	} from '$lib/api/circuitApi';
	import { currentCircuitId, currentCircuitIsPublic, currentCircuitName } from '$lib/IR/stores';
	import { applyCircuit } from '$lib/circuit/applyCircuit';
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
		renameInCircuitListCache,
		setPublicInCircuitListCache
	} from '$lib/stores/circuitListCache';

	export let onClose: () => void;

	// Start with the saved cache so reopening shows the list right away. onMount
	// still fetches fresh data in the background (no spinner when we already have data).
	const cached = get(circuitListCache);

	let circuits: CircuitSummary[] = cached.circuits;
	let total = cached.total;
	let loading = !cached.loaded;
	let loadingMore = false;
	let page = 1;
	let hasMore = cached.hasMore;
	let deletingId = '';
	// The circuit being fetched and drawn right now, if any. Also acts as the
	// guard that stops a second row being opened while one is still loading.
	let openingId = '';

	let contextMenuVisible = false;
	let contextMenuX = 0;
	let contextMenuY = 0;
	let contextMenuCircuit: CircuitSummary | null = null;
	let contextMenuEl: HTMLElement | null = null;

	// Multi-select for deleting many at once. We replace the value (not change it in place) so the list redraws.
	let selectedIds = new Set<string>();
	let bulkDeleting = false;
	let confirmDeleteOpen = false;
	let selectingAll = false;
	$: selectedCount = selectedIds.size;
	$: allSelected = total > 0 && selectedCount >= total;

	// Any active selection puts the list in "select mode": clicking a row toggles
	// its selection instead of loading the circuit, so an accidental click can't open one.
	$: selecting = selectedCount > 0;

	// Select every circuit, including ones on pages not loaded yet, by fetching
	// all ids. If everything is already selected, it clears the selection instead.
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

	async function handleContextMenu(circuit: CircuitSummary, e: MouseEvent) {
		e.preventDefault();
		contextMenuCircuit = circuit;
		contextMenuX = e.clientX;
		contextMenuY = e.clientY;
		contextMenuVisible = true;

		// Position it once it exists, because its height depends on which items the
		// circuit gets (public circuits have two extra rows). Move it to the other
		// side of the cursor when there is no room, then keep it inside the screen,
		// so it can never end up half off-screen near an edge.
		//
		// We use offsetWidth/Height instead of getBoundingClientRect: the opening
		// animation starts at scale(0.95), and a measured rect would include that
		// and place the menu a few pixels off.
		await tick();
		if (!contextMenuEl) return;
		const MARGIN = 8;
		const w = contextMenuEl.offsetWidth;
		const h = contextMenuEl.offsetHeight;
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		const flippedX = e.clientX + w + MARGIN > vw ? e.clientX - w : e.clientX;
		const flippedY = e.clientY + h + MARGIN > vh ? e.clientY - h : e.clientY;
		// Keep it on screen after flipping: flipping alone is not enough when the
		// menu is wider or taller than the space on either side.
		contextMenuX = Math.max(MARGIN, Math.min(flippedX, vw - w - MARGIN));
		contextMenuY = Math.max(MARGIN, Math.min(flippedY, vh - h - MARGIN));
	}

	function closeContextMenu() {
		contextMenuVisible = false;
		contextMenuCircuit = null;
	}

	async function openCircuit(circuit: CircuitSummary) {
		// Fetching the circuit and drawing it takes long enough to notice, so the
		// row says it is working. Without this a click looks like it did nothing,
		// and people click again.
		if (openingId) return;
		closeContextMenu();
		openingId = circuit.circuit_id;
		try {
			const ir = await loadCircuit(circuit.circuit_id);
			applyCircuit(ir, {
				id: circuit.circuit_id,
				name: circuit.name,
				saved: true,
				isPublic: circuit.is_public
			});
			showNotification(`"${circuit.name}" loaded.`, 'success');
			onClose();
		} catch {
			showNotification('Failed to load circuit.', 'error');
		} finally {
			openingId = '';
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

	// Replace the object instead of changing `circuit.is_public` in place. Svelte does
	// not notice changes to a property of an object inside an array, so the row's
	// Public badge would not redraw. The cache is updated too, because reopening the
	// panel loads from it.
	function markPublic(circuit_id: string, is_public: boolean) {
		circuits = circuits.map((c) => (c.circuit_id === circuit_id ? { ...c, is_public } : c));
		setPublicInCircuitListCache(circuit_id, is_public);
		// If this is the circuit on the board, its indicator has to move too.
		if (circuit_id === get(currentCircuitId)) currentCircuitIsPublic.set(is_public);
	}

	// Make the circuit public (if it isn't already) and copy a share link to the
	// clipboard. Asking for a link means making it public, because a link to a
	// private circuit would just give a 404 to whoever opens it.
	async function handleShare(circuit: CircuitSummary) {
		closeContextMenu();
		try {
			if (!circuit.is_public) {
				await setCircuitPublic(circuit.circuit_id, true);
				markPublic(circuit.circuit_id, true);
			}
			const link = `${window.location.origin}/?circuit=${circuit.circuit_id}`;
			await copyToClipboard(link);
			showNotification(`"${circuit.name}" is public — link copied.`, 'success');
		} catch {
			showNotification('Failed to create a share link.', 'error');
		}
	}

	async function handleUnshare(circuit: CircuitSummary) {
		closeContextMenu();
		try {
			await setCircuitPublic(circuit.circuit_id, false);
			markPublic(circuit.circuit_id, false);
			showNotification(`"${circuit.name}" is private again.`, 'success');
		} catch {
			showNotification('Failed to make the circuit private.', 'error');
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
				<div class="flex items-center justify-center h-40" style="color: var(--color-measured);">
					<Loader size="md" label="Loading your circuits" />
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
							<Loader size={15} />
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
								class:is-opening={openingId === circuit.circuit_id}
								class:is-waiting={openingId !== '' && openingId !== circuit.circuit_id}
								style="background-color: var(--color-surface);"
								role="button"
								tabindex="0"
								aria-busy={openingId === circuit.circuit_id}
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
											{#if circuit.is_public}
												<span
													class="shrink-0 inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700"
													title="Public — anyone with the link can view this circuit"
												>
													<Icon icon="ph:globe-simple-bold" width="12" height="12" />
													Public
												</span>
											{/if}
										</div>
										<span class="text-xs" style="color: var(--color-muted);">
											{formatDate(circuit.updated_at)}
										</span>
									</div>
								</div>

								{#if deletingId === circuit.circuit_id}
									<span style="color: var(--color-measured);">
										<Loader size={18} label="Deleting this circuit" />
									</span>
								{:else if openingId === circuit.circuit_id}
									<!-- Named rather than a bare spinner: with the drawer still open
									     over the board, "Loading…" on its own would not say which
									     circuit is on its way. -->
									<span
										class="flex shrink-0 items-center gap-1.5 text-xs"
										style="color: var(--color-measured);"
									>
										<Loader size={16} />
										Loading…
									</span>
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
							<Loader size={16} />
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
							<Loader size={16} />
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

<!-- Context menu drawn at the top level so the side panel never cuts it off -->
{#if contextMenuVisible && contextMenuCircuit}
	<div
		bind:this={contextMenuEl}
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
		{#if contextMenuCircuit.is_public}
			<button
				class="ctx-menu-item"
				role="menuitem"
				on:click={() => handleShare(contextMenuCircuit!)}
			>
				<Icon icon="ph:link-bold" width="16" height="16" />
				Copy Share Link
			</button>
			<button
				class="ctx-menu-item"
				role="menuitem"
				on:click={() => handleUnshare(contextMenuCircuit!)}
			>
				<Icon icon="ph:globe-x" width="16" height="16" />
				Make Private
			</button>
		{:else}
			<button
				class="ctx-menu-item"
				role="menuitem"
				on:click={() => handleShare(contextMenuCircuit!)}
			>
				<Icon icon="ph:share-network-bold" width="16" height="16" />
				Share Publicly
			</button>
		{/if}
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
	/* While a circuit is being fetched and drawn, its own row keeps a highlight
	   and every other row steps back, so it is obvious which one is on its way.
	   The other rows also stop taking clicks: a second one cannot be started
	   until this one finishes. */
	.circuit-row.is-opening {
		cursor: progress;
		box-shadow:
			0 0 0 1.5px var(--color-measured),
			0 1px 2px rgb(0 0 0 / 0.1);
	}

	.circuit-row.is-waiting {
		opacity: 0.5;
		pointer-events: none;
	}

	/* Custom checkbox: see-through background when not selected, brand colour and a
	   tick when selected (the browser's own `accent-color` leaves a solid white box when unchecked). */
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
