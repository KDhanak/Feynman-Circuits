<script lang="ts">
	import { qecMode, qubitLimit } from '$lib/qec/stores';
	import type { UnitaryOperation } from '$lib/IR/schema';
	import { onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import { slide } from 'svelte/transition';
	import { simulationResult, circuitIR, currentCircuitName } from '$lib/IR/stores';
	import { circuitLayout, isDragging, armedGate, saveStatus } from '$lib/stores/uiStores';
	import { session } from '$lib/auth/session';
	import {
		handleDrop,
		handleDragOver,
		triggerSimulation,
		placeArmedGate,
		pendingControls,
		pendingAntiControls,
		editGateRequest
	} from '$lib/circuit/dragDropUtils';
	import { updateQubitLabel } from '$lib/circuit/qubitLables';
	import { buildCanonicalString } from '$lib/circuit/circuitDataModal';
	import { copyToClipboard } from '$lib/circuit/circuitActions';
	import { buildInlineLink } from '$lib/circuit/handoff';
	import { isCircuitSaved, manualSave } from '$lib/circuit/autoSave';
	import { currentCircuitId, currentCircuitIsPublic } from '$lib/IR/stores';
	import { setCircuitPublic } from '$lib/api/circuitApi';
	import { setPublicInCircuitListCache } from '$lib/stores/circuitListCache';
	import { showNotification } from '$lib/utils/notificationUtils';
	import { undo, redo } from '$lib/IR/history';
	import { isTypingTarget } from '$lib/utils/keyboard';
	import ShareDialog from '../ShareDialog.svelte';
	import NameDialog from '../NameDialog.svelte';
	import Icon from '@iconify/svelte';
	import WireBloch from '../BlochSphere/WireBloch.svelte';
	import ConnectorLayer from './ConnectorLayer.svelte';
	import GateContextMenu from './GateContextMenu.svelte';
	import GateToken from './GateToken.svelte';
	import {
		COLUMN_WIDTH,
		MAX_COLUMNS,
		MIN_COLUMN_WIDTH,
		COLUMN_BUFFER,
		MIN_VISIBLE_COLUMNS
	} from '$lib/utils/constants';
	import {
		selectedGateIds,
		isDragSelecting,
		dragStart,
		dragCurrent,
		handleBoardMouseDown,
		deleteSelectedGates,
		clearSelection
	} from '$lib/circuit/selection';
	import { isMobile } from '$lib/stores/isMobile';

	let columnWidth: number;
	let scrollContainer: HTMLDivElement | null = null;
	let hoveredWire: number | null = null;
	let gateMenuVisible = false;
	let gateMenuX = 0;
	let gateMenuY = 0;
	let gateMenuGate: UnitaryOperation | null = null;
	let totalWidth: number;
	$: ({ columnWidth, totalWidth } = $circuitLayout);

	let centerEl: HTMLDivElement | null = null;
	let centerWidth = 0;

	// How many columns the circuit currently occupies (highest used column + 1).
	$: usedColumns = $circuitIR.operations.reduce((max, op) => Math.max(max, op.column + 1), 0);

	// How many drop zone columns to draw. We show the used columns plus a few empty
	// ones to drop into, but never so few that the panel isn't filled (so the board
	// never looks too short), and never more than the maximum. Working this out
	// from the circuit, instead of always drawing MAX_COLUMNS, is what lets a small
	// circuit fit without an unneeded horizontal scrollbar.
	$: visibleColumns = (() => {
		const needed = Math.max(usedColumns + COLUMN_BUFFER, MIN_VISIBLE_COLUMNS);
		if ($isMobile || centerWidth <= 0) return Math.min(needed, MAX_COLUMNS);
		// Enough columns so that, at their ideal width, they fill the panel.
		const fillPanel = Math.ceil(centerWidth / COLUMN_WIDTH);
		return Math.min(Math.max(needed, fillPanel), MAX_COLUMNS);
	})();

	// On desktop, fit the column width to the centre panel. Mobile keeps the fixed
	// width and scrolls. Only when visibleColumns × MIN_COLUMN_WIDTH is wider than
	// the panel does the width stop at its minimum and the track start to scroll.
	// There is a check so the store update happens once instead of looping forever.
	$: {
		const columnWidth =
			$isMobile || centerWidth <= 0
				? COLUMN_WIDTH
				: Math.max(
						MIN_COLUMN_WIDTH,
						Math.min(COLUMN_WIDTH, Math.floor((centerWidth - 2) / visibleColumns))
					);
		const totalWidth = visibleColumns * columnWidth;
		if (columnWidth !== $circuitLayout.columnWidth || totalWidth !== $circuitLayout.totalWidth) {
			circuitLayout.set({ columnWidth, totalWidth });
		}
	}

	let boardEl: HTMLDivElement | null = null;
	let connectorLayer: ConnectorLayer | undefined;

	$: wires = Array.from({ length: $circuitIR.registers.q }, (_, i) => ({
		id: `wire-${i}`,
		qubit: i
	}));

	$: showGhostWire =
		($isDragging || ($isMobile && $armedGate)) && $circuitIR.registers.q < $qubitLimit;

	// While dragging a gate, scroll the board by itself when the pointer gets near the
	// top/bottom edge (the closer, the faster). This replaces the old code that always
	// jumped the view to the bottom every time the ghost wire appeared.
	const EDGE_ZONE = 60; // px from an edge that starts auto-scrolling
	const MAX_EDGE_SPEED = 14; // px per frame at the very edge
	let edgeScrollDir = 0; // -1 = up, 1 = down, 0 = idle
	let edgeScrollSpeed = 0;
	let edgeScrollRaf: number | null = null;

	function updateEdgeScroll(clientY: number) {
		if (!scrollContainer) return;
		const rect = scrollContainer.getBoundingClientRect();
		const topDist = clientY - rect.top;
		const bottomDist = rect.bottom - clientY;

		if (topDist < EDGE_ZONE) {
			edgeScrollDir = -1;
			edgeScrollSpeed = Math.ceil(((EDGE_ZONE - topDist) / EDGE_ZONE) * MAX_EDGE_SPEED);
		} else if (bottomDist < EDGE_ZONE) {
			edgeScrollDir = 1;
			edgeScrollSpeed = Math.ceil(((EDGE_ZONE - bottomDist) / EDGE_ZONE) * MAX_EDGE_SPEED);
		} else {
			edgeScrollDir = 0;
		}

		if (edgeScrollDir !== 0 && edgeScrollRaf === null) {
			const step = () => {
				if (edgeScrollDir === 0 || !scrollContainer) {
					edgeScrollRaf = null;
					return;
				}
				scrollContainer.scrollTop += edgeScrollDir * edgeScrollSpeed;
				connectorLayer?.recomputeConnectorsSync();
				edgeScrollRaf = requestAnimationFrame(step);
			};
			edgeScrollRaf = requestAnimationFrame(step);
		}
	}

	function stopEdgeScroll() {
		edgeScrollDir = 0;
		if (edgeScrollRaf !== null) {
			cancelAnimationFrame(edgeScrollRaf);
			edgeScrollRaf = null;
		}
	}

	// End edge-scrolling as soon as the drag finishes.
	$: if (!$isDragging) stopEdgeScroll();

	function hasGatesOnWire(qubitIndex: number) {
		return $circuitIR.operations.some((op) => {
			if ('targets' in op && (op.targets as number[]).includes(qubitIndex)) return true;
			if (op.kind === 'unitary') {
				const unitOp = op as UnitaryOperation;
				if (unitOp.controls.includes(qubitIndex)) return true;
				if (unitOp.antiControls.includes(qubitIndex)) return true;
			}
			return false;
		});
	}

	function addQubitWire() {
		const ir = $circuitIR;
		if (ir.registers.q >= $qubitLimit) return;
		const newIndex = ir.registers.q;
		circuitIR.set({
			...ir,
			registers: { ...ir.registers, q: ir.registers.q + 1 },
			qubitLabels: [...ir.qubitLabels, `Qubit ${newIndex}`]
		});
		triggerSimulation($circuitIR);
	}

	function removeLastQubitWire() {
		removeQubitWire($circuitIR.registers.q - 1);
	}

	// Set the number of qubits from the text box. Adding always puts new wires at
	// the end (labels are kept). Removing takes wires off the end, but stops at the
	// first one that has gates, so a wire in use is never removed without warning.
	function setQubitCount(target: number) {
		const clamped = Math.max(1, Math.min($qubitLimit, Math.floor(target)));
		const ir = $circuitIR;
		if (clamped > ir.registers.q) {
			const start = ir.registers.q;
			const added = Array.from({ length: clamped - start }, (_, i) => `Qubit ${start + i}`);
			circuitIR.set({
				...ir,
				registers: { ...ir.registers, q: clamped },
				qubitLabels: [...ir.qubitLabels, ...added]
			});
			triggerSimulation($circuitIR);
		} else if (clamped < ir.registers.q) {
			while ($circuitIR.registers.q > clamped) {
				const last = $circuitIR.registers.q - 1;
				if (hasGatesOnWire(last)) break;
				removeQubitWire(last);
			}
		}
	}

	// Read the text box when the user confirms (change / Enter), then reset the box
	// to the real count. This handles bad input and values that setQubitCount limited.
	function commitQubitCount(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		const n = parseInt(el.value, 10);
		if (!Number.isNaN(n)) setQubitCount(n);
		el.value = String($circuitIR.registers.q);
	}

	// The last qubit can only be removed when there is more than one qubit and it has
	// no gates (the same checks as removeQubitWire, used here to enable/disable the button).
	$: canRemoveLastQubit = $circuitIR.registers.q > 1 && !hasGatesOnWire($circuitIR.registers.q - 1);

	function removeQubitWire(qubitIndex: number) {
		const ir = $circuitIR;
		if (ir.registers.q <= 1) return;
		if (hasGatesOnWire(qubitIndex)) return;

		// Update all operations: move qubits above the removed one down by 1
		const remappedOps = ir.operations
			.map((op) => {
				const remapQubit = (q: number) => (q > qubitIndex ? q - 1 : q);
				const remapQubits = (qs: number[]) => qs.filter((q) => q !== qubitIndex).map(remapQubit);

				if (op.kind === 'unitary') {
					return {
						...op,
						targets: remapQubits((op as UnitaryOperation).targets),
						controls: remapQubits((op as UnitaryOperation).controls),
						antiControls: remapQubits((op as UnitaryOperation).antiControls)
					};
				}
				if ('targets' in op) {
					return { ...op, targets: remapQubits(op.targets as number[]) };
				}
				return op;
			})
			.filter((op) => {
				// Remove ops with empty targets
				if ('targets' in op) return (op.targets as number[]).length > 0;
				return true;
			});

		circuitIR.set({
			...ir,
			registers: { ...ir.registers, q: ir.registers.q - 1 },
			qubitLabels: ir.qubitLabels.filter((_, i) => i !== qubitIndex),
			operations: remappedOps
		});
		triggerSimulation($circuitIR);
	}

	function closeGateMenu() {
		gateMenuVisible = false;
		gateMenuGate = null;
	}

	function handleGateContextMenu(e: CustomEvent<{ gate: UnitaryOperation; x: number; y: number }>) {
		gateMenuGate = e.detail.gate;
		gateMenuX = e.detail.x;
		gateMenuY = e.detail.y;
		gateMenuVisible = true;
	}

	// A newly dropped RX/RY/RZ/SWAP gate stores its id here. Open the same small edit
	// box for it, placed next to the gate token that was just drawn.
	$: openRequestedGateEditor($editGateRequest);

	async function openRequestedGateEditor(id: string | null) {
		if (!id) return;
		editGateRequest.set(null); // mark the request as handled
		await tick(); // wait for the new gate token to render
		const op = $circuitIR.operations.find((o) => o.id === id);
		if (!op || op.kind !== 'unitary') return;
		const el = boardEl?.querySelector(`[data-gate-id="${id}"]`) as HTMLElement | null;
		const rect = el?.getBoundingClientRect();
		gateMenuGate = op as UnitaryOperation;
		gateMenuX = rect ? rect.left : 0;
		gateMenuY = rect ? rect.bottom + 6 : 0;
		gateMenuVisible = true;
	}

	// Drag/drop is handled once for the whole board. Instead of adding listeners to
	// every (column × wire) drop zone, which would be columns × wires listeners, we
	// work out the target cell from the pointer position and the wire row under it.
	function resolveCell(
		target: EventTarget | null,
		clientX: number
	): { col: number; qubit: number } | null {
		const row = (target as HTMLElement | null)?.closest?.('[data-wire-row]') as HTMLElement | null;
		if (!row) return null;
		const qubit = Number(row.dataset.qubit);
		if (Number.isNaN(qubit)) return null;
		const x = clientX - row.getBoundingClientRect().left;
		if (x < 0) return null;
		const col = Math.floor(x / columnWidth);
		if (col < 0 || col >= MAX_COLUMNS) return null;
		return { col, qubit };
	}

	function handleBoardDragOver(e: DragEvent) {
		// Scroll when hovering near an edge, even over areas that are not cells (labels, ghost wire).
		updateEdgeScroll(e.clientY);
		// Only allow the drop (preventDefault) when the pointer is over a valid cell.
		if (resolveCell(e.target, e.clientX)) handleDragOver(e);
	}

	function handleBoardDrop(e: DragEvent) {
		stopEdgeScroll();
		const cell = resolveCell(e.target, e.clientX);
		if (cell) handleDrop(e, cell.col, cell.qubit);
	}

	// Mobile tap-to-place / tap-to-move, called from the board's click handler.
	// Returns true when it used the tap, so the caller can skip clearing the selection.
	function handleBoardTap(e: MouseEvent): boolean {
		if (!$isMobile || !$armedGate) return false;
		// A tap on a gate means picking or selecting that gate, never dropping onto it.
		// Otherwise tapping a gate to pick it up would right away try to drop the
		// selected gate onto the cell under the tap.
		if ((e.target as HTMLElement).closest('.gate')) return false;
		const cell = resolveCell(e.target, e.clientX);
		if (!cell) return false;
		const wasMove = $armedGate.source === 'wire';
		placeArmedGate(cell.col, cell.qubit);
		// A moved gate has reached its spot, so clear the selection and the board no
		// longer shows it as picked up. A palette gate stays selected for more taps.
		if (wasMove) clearSelection();
		return true;
	}

	function resetCircuitBoard() {
		// Import resetCircuit from simulator
		import('$lib/circuit/simulator').then(({ resetCircuit }) => {
			resetCircuit();
		});
	}

	function copyCircuit() {
		copyToClipboard(buildCanonicalString($circuitIR));
	}

	// --- Sharing ------------------------------------------------------------
	// Two kinds of link. We pick one based on the circuit, instead of asking the
	// user. A saved circuit that the signed-in user owns can be made public, which
	// gives a short link that shows later edits and can be turned off later.
	// Anything else (signed out, or never saved) gets a link with the whole circuit
	// inside the URL, so sharing never needs an account.
	let shareOpen = false;

	// Save/rename sits with the board's other whole-circuit buttons instead of in
	// the gate palette: it works on the circuit, not on a gate, and the palette
	// needs its space for gates.
	let showNameDialog = false;

	function openNameDialog() {
		if (get(session).status !== 'authenticated') {
			showNotification('Please sign in to save your circuit.', 'error');
			return;
		}
		showNameDialog = true;
	}

	async function saveCircuit(newName: string) {
		showNameDialog = false;
		const wasSaved = get(isCircuitSaved);
		const previousName = $currentCircuitName;
		currentCircuitName.set(newName);
		try {
			await manualSave();
			showNotification(wasSaved ? 'Circuit renamed!' : 'Circuit saved!', 'success');
		} catch (err: unknown) {
			currentCircuitName.set(previousName);
			const apiMessage = (err as { response?: { data?: { name?: string[] } } })?.response?.data
				?.name?.[0];
			showNotification(apiMessage ?? 'Failed to save circuit. Please try again.', 'error');
		}
	}
	let shareLink = '';
	let shareKind: 'public' | 'inline' = 'inline';
	let sharing = false;

	async function shareCircuit() {
		if (sharing) return;
		sharing = true;
		try {
			const canPublish = $session.status === 'authenticated' && $isCircuitSaved;
			if (canPublish) {
				const id = get(currentCircuitId);
				await setCircuitPublic(id, true);
				// Keep the circuit list's Public badge correct without fetching again.
				setPublicInCircuitListCache(id, true);
				currentCircuitIsPublic.set(true);
				shareLink = `${window.location.origin}/?circuit=${id}`;
				shareKind = 'public';
			} else {
				shareLink = await buildInlineLink(window.location.origin, $circuitIR, $currentCircuitName);
				shareKind = 'inline';
			}
			shareOpen = true;
		} catch (err) {
			// buildInlineLink throws an error with a clear message when the circuit is too
			// big to fit in a link. Any other error means the publish request failed.
			showNotification(
				err instanceof Error && err.message ? err.message : 'Failed to create a share link.',
				'error'
			);
		} finally {
			sharing = false;
		}
	}

	function copyShareLink() {
		copyToClipboard(shareLink);
	}

	onMount(() => {
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (gateMenuVisible && !target.closest('.gate-ctx-menu')) {
				closeGateMenu();
			}
		};

		// Board shortcuts. They listen on the whole document, so they must do
		// nothing while the user is typing in the circuit name, a qubit label or
		// a gate angle box.
		const handleBoardKeys = (e: KeyboardEvent) => {
			if (isTypingTarget(e)) return;

			if (e.key === 'Delete' && get(selectedGateIds).size > 0) {
				e.preventDefault();
				deleteSelectedGates();
				return;
			}

			if (!(e.ctrlKey || e.metaKey)) return;
			const key = e.key.toLowerCase();
			// Ctrl+Z undoes, Ctrl+Shift+Z and Ctrl+Y redo. Both redo shortcuts are
			// here because Windows apps use Ctrl+Y and Mac apps use Ctrl+Shift+Z.
			if (key === 'z' && !e.shiftKey) {
				e.preventDefault();
				undo();
			} else if ((key === 'z' && e.shiftKey) || key === 'y') {
				e.preventDefault();
				redo();
			}
		};

		// Let the mouse wheel scroll the board during a drag. Browsers turn off normal
		// wheel scrolling while an HTML5 drag is happening, so we scroll it ourselves.
		// The listener must be non-passive, or preventDefault won't work.
		const handleDragWheel = (e: WheelEvent) => {
			if (!scrollContainer || !get(isDragging)) return;
			e.preventDefault();
			scrollContainer.scrollTop += e.deltaY;
			connectorLayer?.recomputeConnectorsSync();
		};

		document.addEventListener('click', handleClickOutside);
		document.addEventListener('keydown', handleBoardKeys);
		scrollContainer?.addEventListener('wheel', handleDragWheel, { passive: false });
		return () => {
			document.removeEventListener('click', handleClickOutside);
			document.removeEventListener('keydown', handleBoardKeys);
			scrollContainer?.removeEventListener('wheel', handleDragWheel);
			stopEdgeScroll();
		};
	});
</script>

<div
	role="none"
	class="w-full h-full relative mx-auto z-50 select-none"
	bind:this={boardEl}
	on:mousedown={(e) => !$isMobile && handleBoardMouseDown(e)}
	on:drop={handleBoardDrop}
	on:dragover={handleBoardDragOver}
	on:click={(e) => {
		if (handleBoardTap(e)) return;
		const target = e.target as HTMLElement;
		// Clear selection when clicking on empty space (not gates or labels)
		if (
			!target.classList.contains('gate') &&
			!target.classList.contains('qubit-label') &&
			(target.classList.contains('wire-container') ||
				target.classList.contains('dropzone') ||
				target === boardEl)
		) {
			clearSelection();
		}
	}}
	on:keydown={(e) => {
		if (e.key === 'Escape') closeGateMenu();
	}}
>
	<!-- Add/remove qubit buttons, pinned to the board's top-left corner (icons only).
	     Hidden on mobile while the delete-selected button is in the same spot. -->
	{#if !($isMobile && $selectedGateIds.size > 0)}
		<div
			class="absolute top-2 pl-0.5 left-1.5 z-200 flex items-center backdrop-blur-lg rounded-sm shadow-sm"
			style="color: var(--color-muted);"
		>
			<button
				type="button"
				class="flex cursor-pointer items-center justify-center rounded-sm p-1 transition-colors active:text-ternary-3 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
				on:click|stopPropagation={addQubitWire}
				disabled={$circuitIR.registers.q >= $qubitLimit}
				aria-label="Add qubit"
				title={$qecMode ? 'QEC mode works on one logical qubit' : 'Add qubit'}
			>
				<Icon icon="mdi:plus" width="20" height="20" />
			</button>
			<input
				type="text"
				inputmode="numeric"
				value={$circuitIR.registers.q}
				on:change={commitQubitCount}
				on:keydown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
				on:click|stopPropagation
				aria-label="Number of qubits"
				title="Number of qubits"
				class="z-10 w-10 h-7 px-1 cursor-text text-[11px] focus:scale-105 focus:shadow-sm focus:shadow-ternary-1 text-center rounded-sm focus:outline-none select-auto"
			/>
			<button
				type="button"
				class="flex cursor-pointer items-center justify-center rounded-sm p-1 transition-colors active:text-ternary-3 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
				on:click|stopPropagation={removeLastQubitWire}
				disabled={!canRemoveLastQubit}
				aria-label="Remove last qubit"
				title={canRemoveLastQubit
					? 'Remove last qubit'
					: 'Last qubit is in use or is the only qubit'}
			>
				<Icon icon="mdi:minus" width="20" height="20" />
			</button>
		</div>
	{/if}

	<!-- Circuit name, centred in the strip between the qubit buttons on the left
	     and the copy/reset buttons on the right. Its width is limited to the space
	     between those two groups (~7rem each plus some extra room), so a long name
	     gets cut off with "…" instead of running under them. That keeps it
	     readable on phones. By default, clicks go through the strip. Only the name
	     itself and the save/rename button catch clicks, so the rest of the strip
	     never blocks a tap meant for the board. -->
	<div
		class="absolute p-1 top-2 left-1/2 z-200 flex max-w-[calc(100%-14rem)] -translate-x-1/2 items-center gap-1.5 pointer-events-none"
		style="color: var(--color-muted);"
	>
		<Icon icon="ph:circuit-board" width="15" height="15" class="shrink-0" />
		{#if $session.status === 'authenticated'}
			<span class="w-3.25 h-3.25 shrink-0 flex items-center justify-center">
				{#if $saveStatus === 'saving'}
					<Icon
						icon="svg-spinners:ring-resize"
						width="13"
						height="13"
						style="color: var(--color-measured);"
					/>
				{:else if $saveStatus === 'saved'}
					<Icon icon="ph:check-bold" width="13" height="13" class="text-green-500" />
				{/if}
			</span>
		{/if}
		<!-- Turns clicks back on for the text only, so a cut-off name still shows in
		     full on hover, while clicks still go through the rest of the strip. -->
		<span
			class="truncate text-sm py-1.5 px-4 font-semibold pointer-events-auto backdrop-blur-lg rounded-sm shadow-sm"
			title={$currentCircuitName}>{$currentCircuitName}</span
		>
		<!-- To the right of the name, not the left: the left already has the
		     circuit icon and the save-status dot, and a button makes more sense
		     next to the thing it changes. Floppy disk while unsaved, pencil once
		     the circuit is saved and the button becomes rename. The icon shows
		     what the button does, not the current state. -->
		<button
			type="button"
			class="pointer-events-auto shrink-0 flex cursor-pointer items-center justify-center rounded-sm p-1.5 backdrop-blur-lg shadow-sm transition-colors active:text-green-500"
			on:click|stopPropagation={openNameDialog}
			data-tour="save"
			aria-label={$isCircuitSaved ? 'Rename circuit' : 'Save circuit'}
			title={$isCircuitSaved ? 'Rename circuit' : 'Save circuit'}
		>
			<Icon
				icon={$isCircuitSaved ? 'ph:pencil-simple-bold' : 'ph:floppy-disk-bold'}
				width="15"
				height="15"
			/>
		</button>
		{#if $session.status === 'authenticated' && $currentCircuitIsPublic}
			<span
				class="shrink-0 flex items-center pointer-events-auto text-sky-500"
				title="Public — anyone with the link can view this circuit"
				aria-label="This circuit is public"
			>
				<Icon icon="ph:globe-simple-bold" width="14" height="14" />
			</span>
		{/if}
	</div>

	<!-- Share + Copy + Reset buttons, pinned to the board's top-right corner (icon only) -->
	<div
		class="absolute top-2 right-2 z-200 flex items-center gap-1 backdrop-blur-lg rounded-sm shadow-sm"
		style="color: var(--color-text);"
	>
		<button
			type="button"
			class="cursor-pointer flex items-center justify-center rounded-sm p-1.5 transition-colors active:text-green-500 disabled:cursor-wait disabled:opacity-50"
			on:click|stopPropagation={shareCircuit}
			disabled={sharing}
			aria-label="Share circuit"
			title="Share circuit"
		>
			<Icon icon="ph:share-network-bold" width="18" height="18" />
		</button>
		<button
			type="button"
			class="cursor-pointer flex items-center justify-center rounded-sm p-1.5 transition-colors active:text-green-500"
			on:click|stopPropagation={copyCircuit}
			aria-label="Copy circuit"
			title="Copy circuit"
		>
			<Icon icon="solar:copy-bold" width="18" height="18" />
		</button>
		<button
			type="button"
			class="cursor-pointer flex items-center justify-center rounded-sm p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 active:text-red-700"
			on:click|stopPropagation={resetCircuitBoard}
			aria-label="Reset circuit"
			title="Reset circuit"
		>
			<Icon icon="material-symbols:restart-alt" width="20" height="20" />
		</button>
	</div>

	<!-- Mobile: delete-selected button, pinned to the board's top-left corner -->
	{#if $isMobile && $selectedGateIds.size > 0}
		<button
			type="button"
			class="absolute top-2 left-2 z-200 flex items-center gap-1 rounded-sm bg-red-500 px-3 py-2 text-sm font-semibold text-white shadow-lg active:bg-red-600"
			on:click={deleteSelectedGates}
			aria-label="Delete selected gates"
		>
			<Icon icon="ph:trash-bold" width="18" height="18" />
			{$selectedGateIds.size}
		</button>
	{/if}

	<!-- Drag selection box -->
	{#if $isDragSelecting && $dragStart && $dragCurrent}
		{@const minX = Math.min($dragStart.x, $dragCurrent.x)}
		{@const maxX = Math.max($dragStart.x, $dragCurrent.x)}
		{@const minY = Math.min($dragStart.y, $dragCurrent.y)}
		{@const maxY = Math.max($dragStart.y, $dragCurrent.y)}
		<div
			class="selection-box fixed pointer-events-none border border-blue-400 border-dashed"
			style="left: {minX}px; top: {minY}px; width: {maxX - minX}px; height: {maxY -
				minY}px; z-index: 100; background-color: rgba(59, 130, 246, 0.5);"
		></div>
	{/if}
	<div class="rounded-sm overflow-hidden h-full">
		<div
			class="h-full overflow-y-auto"
			bind:this={scrollContainer}
			on:scroll={() => connectorLayer?.recomputeConnectorsSync()}
		>
			<div class="flex items-start p-2 pt-10">
				<!-- LEFT: qubit box + label (fixed, does not scroll) -->
				<div class="flex shrink-0 flex-col gap-1 pr-1">
					{#each wires as wire (wire.id)}
						{@const measured = $simulationResult?.measuredQubits?.includes(wire.qubit)}
						<div
							role="none"
							class={`flex ${$isMobile ? 'h-12' : 'h-14'} items-center`}
							on:mouseenter={() => (hoveredWire = wire.qubit)}
							on:mouseleave={() => (hoveredWire = null)}
						>
							<!-- Ket badge (translucent) with hover-reveal delete -->
							<div class="relative mr-2 z-10 shrink-0 rounded-sm">
								<div
									class={`flex h-7 select-none items-center justify-center px-2 rounded-sm text-[13px] font-bold leading-none focus:outline-none ${
										measured
											? 'bg-measured/30 text-measured'
											: $qecMode
												? 'bg-qec-1/20 text-qec-1 ring-1 ring-qec-1/60'
												: 'bg-ternary-3/30 text-ternary-1'
									} ${wire.qubit >= 1 ? 'cursor-pointer shadow-sm shadow-ternary-1 active:shadow-none' : 'cursor-default'}`}
									role="button"
									tabindex="0"
									title={$qecMode
										? 'Logical qubit: kept alive by the 17 physical qubits in the QEC panel below'
										: wire.qubit >= 1
											? 'Double-click to remove qubit'
											: ''}
									on:dblclick={() => removeQubitWire(wire.qubit)}
								>
									|0⟩{#if $qecMode}<sub class="ml-px text-[9px] font-semibold">L</sub>{/if}
								</div>
								{#if wire.qubit >= 1 && !hasGatesOnWire(wire.qubit)}
									<button
										class="absolute -top-1 -right-1 size-4 rounded-full border border-ternary-3 cursor-pointer bg-ternary-2 text-white text-[10px] leading-none transition-opacity flex items-center justify-center"
										class:opacity-0={hoveredWire !== wire.qubit}
										class:opacity-100={hoveredWire === wire.qubit}
										on:click={() => removeQubitWire(wire.qubit)}
										aria-label="Remove qubit {wire.qubit}">×</button
									>
								{/if}
							</div>
							<input
								type="text"
								value={$circuitIR.qubitLabels?.[wire.qubit] ?? `Qubit ${wire.qubit}`}
								on:input={(e) => updateQubitLabel(wire.qubit, (e.target as HTMLInputElement).value)}
								placeholder="Label"
								class={`qubit-label z-10 w-13 h-7 px-1.5 cursor-text text-[11px] border ${$qecMode ? 'border-qec-1/60' : 'border-ternary-0'} focus:scale-105 focus:shadow-sm focus:shadow-ternary-1 text-center rounded-sm focus:outline-none select-auto ${
									measured
										? 'bg-orange-100 border-orange-300 text-orange-900 focus:ring-orange-600 focus:border-orange-600'
										: 'text-black input-field'
								}`}
							/>
						</div>
					{/each}
					{#if showGhostWire}
						<div
							class={`flex ${$isMobile ? 'h-12' : 'h-14'} items-center opacity-60`}
							transition:slide={{ duration: 300 }}
						>
							<div
								class="z-10 mr-2 flex h-7 shrink-0 select-none items-center justify-center rounded-sm bg-ternary-2/25 px-2 text-[13px] font-medium leading-none text-ternary-3 opacity-50"
							>
								|0⟩
							</div>
							<input
								type="text"
								value="Qubit {$circuitIR.registers.q}"
								disabled
								class="z-10 w-13 h-7 px-1.5 text-[11px] border border-dashed border-ternary-3 text-black text-center rounded-sm bg-purple-100 bg-opacity-30 shadow-lg opacity-50"
							/>
						</div>
					{/if}
				</div>
				<!-- CENTER: scrollable gate track -->
				<div
					class="relative flex flex-1 flex-col gap-1 overflow-x-auto"
					bind:this={centerEl}
					bind:clientWidth={centerWidth}
					on:scroll={() => connectorLayer?.recomputeConnectorsSync()}
				>
					<!-- Connectors -->
					<ConnectorLayer bind:this={connectorLayer} boardEl={centerEl} />
					{#each wires as wire (wire.id)}
						<div
							role="row"
							tabindex="-1"
							class={`relative flex ${$isMobile ? 'h-12' : 'h-14'} items-center`}
							style={`min-width: ${totalWidth}px`}
							data-wire-row
							data-qubit={wire.qubit}
						>
							<!-- Wire line -->
							<div
								class="wire-container absolute left-0 rounded-full right-0 top-1/2 h-0.5 -translate-y-1/2 transform"
								style="background-color: var(--color-muted);"
							>
								{#each Array(visibleColumns) as _, colIndex (colIndex)}
									<div
										class="dropzone h-12 top-1/2 -translate-y-1/2 transform"
										class:dropzone-armed={$isMobile && $armedGate}
										style="left: {colIndex * columnWidth}px; width: {columnWidth}px"
									></div>
								{/each}
							</div>
							<!-- Gates -->
							{#each $circuitIR.operations as op (op.id)}
								<GateToken
									{op}
									qubit={wire.qubit}
									{columnWidth}
									on:gatecontextmenu={handleGateContextMenu}
								/>
							{/each}
							<!-- Waiting anti-control boxes (not attached to a gate yet) -->
							{#each Array.from($pendingAntiControls.entries()) as [col, qubits] (col)}
								{#each qubits as antiControlQubit (antiControlQubit)}
									{#if antiControlQubit === wire.qubit}
										<div
											data-col={col}
											data-qubit={antiControlQubit}
											data-type="ANTI_CONTROL"
											role="button"
											aria-label="Pending anti-control (place a gate in this column to attach)"
											tabindex="0"
											on:keydown={(e) =>
												e.key === 'Delete' &&
												pendingAntiControls.update((map) => {
													const next = new Map(map);
													const qubits = next.get(col) ?? [];
													next.set(
														col,
														qubits.filter((q) => q !== antiControlQubit)
													);
													if (next.get(col)?.length === 0) next.delete(col);
													return next;
												})}
											class="gate z-10 select-none rounded-sm h-9 w-9 text-sm border bg-orange-200 shadow transition-colors duration-100 opacity-75 flex items-center justify-center"
											style="left: {(col + 0.5) * columnWidth}px;"
										>
											<div class="w-3 h-3 rounded-full border border-orange-600"></div>
										</div>
									{/if}
								{/each}
							{/each}
							<!-- Waiting control boxes (not attached to a gate yet) -->
							{#each Array.from($pendingControls.entries()) as [col, qubits] (col)}
								{#each qubits as controlQubit (controlQubit)}
									{#if controlQubit === wire.qubit}
										<div
											data-col={col}
											data-qubit={controlQubit}
											data-type="CONTROL"
											role="button"
											aria-label="Pending control (place a gate in this column to attach)"
											tabindex="0"
											on:keydown={(e) =>
												e.key === 'Delete' &&
												pendingControls.update((map) => {
													const next = new Map(map);
													const qubits = next.get(col) ?? [];
													next.set(
														col,
														qubits.filter((q) => q !== controlQubit)
													);
													if (next.get(col)?.length === 0) next.delete(col);
													return next;
												})}
											class="gate z-10 select-none rounded-sm h-9 w-9 text-sm border bg-yellow-300 border-yellow-500 shadow transition-colors duration-100 opacity-75 flex items-center justify-center"
											style="left: {(col + 0.5) * columnWidth}px;"
										>
											<div class="w-3 h-3 rounded-full bg-yellow-600"></div>
										</div>
									{/if}
								{/each}
							{/each}
						</div>
					{/each}
					{#if showGhostWire}
						<div
							class="ghost-wire relative flex h-14 items-center"
							style={`min-width: ${totalWidth}px`}
							data-wire-row
							data-qubit={$circuitIR.registers.q}
							transition:slide={{ duration: 300 }}
						>
							<div
								class="wire-container absolute left-0 rounded-full right-0 top-1/2 h-0.5 -translate-y-1/2 transform opacity-30"
								style="background-color: var(--color-muted);"
							>
								{#each Array(visibleColumns) as _, colIndex (colIndex)}
									<div
										class="dropzone h-12 top-1/2 -translate-y-1/2 transform"
										class:dropzone-armed={$isMobile && $armedGate}
										style="left: {colIndex * columnWidth}px; width: {columnWidth}px"
									></div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
				<!-- RIGHT: Bloch sphere (fixed, does not scroll) -->
				{#if !$isMobile}
					<!-- gap-1 must match the label and wire columns. All three are
					     separate stacks, so a different row spacing here makes the
					     spheres move 4px further away from their wire on every row. -->
					<div class="flex flex-col gap-1">
						{#each wires as wire (wire.id)}
							<div class="flex h-14 items-center justify-start">
								<WireBloch qubit={wire.qubit} />
							</div>
						{/each}
						{#if showGhostWire}
							<div class="flex h-14 items-center" transition:slide={{ duration: 300 }}></div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Gate Edit Context Menu -->
	{#if gateMenuVisible && gateMenuGate}
		<GateContextMenu gate={gateMenuGate} x={gateMenuX} y={gateMenuY} on:close={closeGateMenu} />
	{/if}
</div>

<ShareDialog
	open={shareOpen}
	kind={shareKind}
	link={shareLink}
	onCopy={copyShareLink}
	onClose={() => (shareOpen = false)}
/>

<NameDialog
	open={showNameDialog}
	title={$isCircuitSaved ? 'Rename Circuit' : 'Save Circuit'}
	value={$currentCircuitName}
	confirmLabel="Save"
	onConfirm={saveCircuit}
	onCancel={() => (showNameDialog = false)}
/>

<style>
	.ghost-wire {
		opacity: 0.6;
	}
	.ghost-wire :global(.dropzone:hover) {
		background-color: rgba(168, 85, 247, 0.15);
		border-radius: 4px;
	}

	/* Waiting control/anti-control boxes use the `.gate` class for positioning.
	   The placed gates moved to GateToken.svelte (with their own scoped
	   `.gate` rule), but these waiting boxes are still here and need it too. */
	.gate {
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
		z-index: 10;
		white-space: nowrap;
	}

	.dropzone {
		position: absolute;
		top: 0;
		bottom: 0;
		background-color: transparent;
		transition: background-color 0.2s ease;
	}
	.dropzone:hover {
		background-color: rgba(168, 85, 247, 0.15);
		border-radius: 4px;
	}

	/* Mobile tap-to-place: highlight tappable cells while a gate is selected. */
	.dropzone-armed {
		background-color: rgba(168, 85, 247, 0.12);
		border: 1px dashed var(--color-secondary-2);
		border-radius: 4px;
	}
	.dropzone-armed:active {
		background-color: rgba(168, 85, 247, 0.3);
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.notification {
		animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.selection-box {
		box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.1);
	}
</style>
