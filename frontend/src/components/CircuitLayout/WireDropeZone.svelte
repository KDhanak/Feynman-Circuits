<script lang="ts">
	import type { UnitaryOperation } from '$lib/IR/schema';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { slide } from 'svelte/transition';
	import { simulationResult, circuitIR } from '$lib/IR/stores';
	import {
		circuitLayout,
		isDragging,
		showCircuitDataModal,
		circuitDataModalContent,
		armedGate
	} from '$lib/stores/uiStores';
	import {
		handleDrop,
		handleDragOver,
		triggerSimulation,
		placeArmedGate,
		pendingControls,
		pendingAntiControls
	} from '$lib/circuit/dragDropUtils';
	import { updateQubitLabel } from '$lib/circuit/qubitLables';
	import { buildCanonicalString } from '$lib/circuit/circuitDataModal';
	import { copyToClipboard } from '$lib/circuit/circuitActions';
	import Icon from '@iconify/svelte';
	import WireBloch from '../BlochSphere/WireBloch.svelte';
	import ConnectorLayer from './ConnectorLayer.svelte';
	import BoardContextMenu from './BoardContextMenu.svelte';
	import GateContextMenu from './GateContextMenu.svelte';
	import GateToken from './GateToken.svelte';
	import { MAX_COLUMNS, MAX_QUBITS } from '$lib/utils/constants';
	import {
		selectedGateIds,
		isDragSelecting,
		dragStart,
		dragCurrent,
		handleBoardMouseDown,
		handleBoardMouseMove,
		handleBoardMouseUp,
		deleteSelectedGates,
		cancelDrag,
		clearSelection
	} from '$lib/circuit/selection';
	import { isMobile } from '$lib/stores/isMobile';

	let columnWidth: number;
	let gateOffset: number;
	let scrollContainer: HTMLDivElement | null = null;
	let hoveredWire: number | null = null;
	let contextMenuVisible = false;
	let contextMenuX = 0;
	let contextMenuY = 0;
	let gateMenuVisible = false;
	let gateMenuX = 0;
	let gateMenuY = 0;
	let gateMenuGate: UnitaryOperation | null = null;
	let totalWidth: number;
	$: ({ columnWidth, gateOffset, totalWidth } = $circuitLayout);

	let boardEl: HTMLDivElement | null = null;
	let connectorLayer: ConnectorLayer | undefined;

	$: wires = Array.from({ length: $circuitIR.registers.q }, (_, i) => ({
		id: `wire-${i}`,
		qubit: i
	}));

	$: showGhostWire =
		($isDragging || ($isMobile && $armedGate)) && $circuitIR.registers.q < MAX_QUBITS;

	// While dragging a gate, auto-scroll the board when the pointer nears the top/bottom
	// edge (speed scales with proximity). This replaces the old force-scroll-to-bottom that
	// yanked the view down every time the ghost wire appeared.
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

	function removeQubitWire(qubitIndex: number) {
		const ir = $circuitIR;
		if (ir.registers.q <= 1) return;
		if (hasGatesOnWire(qubitIndex)) return;

		// Remap all operations: shift qubits above the removed one down by 1
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

	function handleContextMenu(e: MouseEvent) {
		e.preventDefault();
		contextMenuX = e.clientX;
		contextMenuY = e.clientY;
		contextMenuVisible = true;
		closeGateMenu();
	}

	function closeContextMenu() {
		contextMenuVisible = false;
	}

	function closeGateMenu() {
		gateMenuVisible = false;
		gateMenuGate = null;
	}

	function handleGateContextMenu(e: CustomEvent<{ gate: UnitaryOperation; x: number; y: number }>) {
		contextMenuVisible = false;
		gateMenuGate = e.detail.gate;
		gateMenuX = e.detail.x;
		gateMenuY = e.detail.y;
		gateMenuVisible = true;
	}

	// Board-level drag/drop delegation. Instead of attaching listeners to every
	// (column × wire) dropzone — O(columns × wires) — resolve the target cell from
	// the pointer's coordinates against the wire row under it.
	function resolveCell(
		target: EventTarget | null,
		clientX: number
	): { col: number; qubit: number } | null {
		const row = (target as HTMLElement | null)?.closest?.('[data-wire-row]') as HTMLElement | null;
		if (!row) return null;
		const qubit = Number(row.dataset.qubit);
		if (Number.isNaN(qubit)) return null;
		const x = clientX - row.getBoundingClientRect().left - gateOffset;
		if (x < 0) return null;
		const col = Math.floor(x / columnWidth);
		if (col < 0 || col >= MAX_COLUMNS) return null;
		return { col, qubit };
	}

	function handleBoardDragOver(e: DragEvent) {
		// Scroll when hovering near an edge, even over non-cell areas (labels, ghost wire).
		updateEdgeScroll(e.clientY);
		// Only allow the drop (preventDefault) when the pointer is over a valid cell.
		if (resolveCell(e.target, e.clientX)) handleDragOver(e);
	}

	function handleBoardDrop(e: DragEvent) {
		stopEdgeScroll();
		const cell = resolveCell(e.target, e.clientX);
		if (cell) handleDrop(e, cell.col, cell.qubit);
	}

	// Mobile tap-to-place, delegated from the board click handler. Returns true when
	// it consumed the tap so the caller can skip selection-clearing.
	function handleBoardTap(e: MouseEvent): boolean {
		if (!$isMobile || !$armedGate) return false;
		const cell = resolveCell(e.target, e.clientX);
		if (!cell) return false;
		placeArmedGate(cell.col, cell.qubit);
		return true;
	}

	function resetAndClose() {
		closeContextMenu();
		// Import resetCircuit from simulator
		import('$lib/circuit/simulator').then(({ resetCircuit }) => {
			resetCircuit();
		});
	}

	onMount(() => {
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (contextMenuVisible && !target.closest('.board-ctx-menu')) {
				closeContextMenu();
			}
			if (gateMenuVisible && !target.closest('.gate-ctx-menu')) {
				closeGateMenu();
			}
		};

		const handleDeleteKey = (e: KeyboardEvent) => {
			if (e.key === 'Delete' && get(selectedGateIds).size > 0) {
				e.preventDefault();
				deleteSelectedGates();
			}
		};

		// Let the mouse wheel scroll the board during a native drag. Browsers suppress
		// default wheel-scrolling while an HTML5 drag is active, so we scroll manually.
		// Non-passive is required for preventDefault to take effect.
		const handleDragWheel = (e: WheelEvent) => {
			if (!scrollContainer || !get(isDragging)) return;
			e.preventDefault();
			scrollContainer.scrollTop += e.deltaY;
			connectorLayer?.recomputeConnectorsSync();
		};

		document.addEventListener('click', handleClickOutside);
		document.addEventListener('keydown', handleDeleteKey);
		scrollContainer?.addEventListener('wheel', handleDragWheel, { passive: false });
		return () => {
			document.removeEventListener('click', handleClickOutside);
			document.removeEventListener('keydown', handleDeleteKey);
			scrollContainer?.removeEventListener('wheel', handleDragWheel);
			stopEdgeScroll();
		};
	});
</script>

<div
	role="none"
	class="w-full h-full relative mx-auto z-50 select-none"
	bind:this={boardEl}
	on:contextmenu={handleContextMenu}
	on:mousedown={(e) => !$isMobile && handleBoardMouseDown(e)}
	on:mousemove={(e) => !$isMobile && handleBoardMouseMove(e)}
	on:mouseup={(e) => !$isMobile && handleBoardMouseUp(e)}
	on:mouseleave={() => !$isMobile && cancelDrag()}
	on:drop={handleBoardDrop}
	on:dragover={handleBoardDragOver}
	on:click={(e) => {
		closeContextMenu();
		if (handleBoardTap(e)) return;
		const target = e.target as HTMLElement;
		// Clear selection when clicking on empty space (not gates or labels)
		if (
			!target.classList.contains('gate') &&
			!target.classList.contains('qubit-label') &&
			(target.classList.contains('wire-container') ||
				target.classList.contains('dropzone') ||
				target.classList.contains('wire-bloch-anchor') ||
				target === boardEl)
		) {
			clearSelection();
		}
	}}
	on:keydown={(e) => {
		if (e.key === 'Escape') closeContextMenu();
	}}
>
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
			class={`space-y-1 p-2 overflow-y-auto h-full ${$isMobile ? 'overflow-x-auto' : 'overflow-x-hidden'}`}
			bind:this={scrollContainer}
			on:scroll={() => connectorLayer?.recomputeConnectorsSync()}
		>
			<!-- Connectors -->
			<ConnectorLayer bind:this={connectorLayer} {boardEl} />

			<!-- Real wires -->
			{#each wires as wire (wire.id)}
				<div
					role="row"
					tabindex="-1"
					class={`relative flex ${$isMobile ? 'h-12' : 'h-14'} items-center`}
					style={$isMobile ? `min-width: ${totalWidth}px` : ''}
					data-wire-row
					data-qubit={wire.qubit}
					on:mouseenter={() => (hoveredWire = wire.qubit)}
					on:mouseleave={() => (hoveredWire = null)}
				>
					<!-- Wire line -->
					<div
						class="wire-container absolute left-0 rounded-full right-0 top-1/2 h-0.5 -translate-y-1/2 transform"
						style="background-color: var(--color-muted);"
					>
						{#each Array(MAX_COLUMNS) as _, colIndex}
							<div
								class="dropzone h-12 top-1/2 -translate-y-1/2 transform"
								class:dropzone-armed={$isMobile && $armedGate}
								style="left: {gateOffset + colIndex * columnWidth}px; width: {columnWidth}px"
							></div>
						{/each}
						{#if !$isMobile}
							<div class="wire-bloch-anchor">
								<WireBloch qubit={wire.qubit} />
							</div>
						{/if}
					</div>

					<!-- Qubit circle with hover-reveal delete button -->
					<div class="relative mr-2 z-10 shrink-0">
						<div
							class={`flex h-10 w-10 select-none items-center justify-center rounded-full border-2 text-sm shadow-sm ${
								$simulationResult?.measuredQubits?.includes(wire.qubit)
									? 'bg-orange-300 border-orange-700 text-orange-800'
									: 'bg-ternary-2 border-white text-white'
							} ${
								wire.qubit >= 1
									? 'cursor-pointer border-dashed active:border-solid active:border-amber-700'
									: 'cursor-default'
							}`}
							role="button"
							tabindex="0"
							on:dblclick={() => removeQubitWire(wire.qubit)}
						>
							|0⟩
						</div>
						{#if wire.qubit >= 1 && !hasGatesOnWire(wire.qubit)}
							<button
								class="absolute -top-1 -right-1 w-4 h-4 rounded-full border border-ternary-3 cursor-pointer bg-ternary-2 text-white text-[10px] leading-none transition-opacity flex items-center justify-center"
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
						class={`qubit-label z-10 w-13 h-6 px-1.5 cursor-text text-[11px] border text-center rounded-sm shadow-sm focus:outline-none focus:ring-1 select-auto ${
							$simulationResult?.measuredQubits?.includes(wire.qubit)
								? 'bg-orange-100 border-orange-300 text-orange-900 focus:ring-orange-600 focus:border-orange-600'
								: 'border-ternary-3 text-black bg-purple-100 focus:ring-purple-600 focus:border-purple-600'
						}`}
					/>

					<!-- Gates -->
					{#each $circuitIR.operations as op (op.id)}
						<GateToken
							{op}
							qubit={wire.qubit}
							{gateOffset}
							{columnWidth}
							on:gatecontextmenu={handleGateContextMenu}
						/>
					{/each}

					<!-- Pending control gate boxes (uncommitted controls)
				-->
					{#each Array.from($pendingAntiControls.entries()) as [col, qubits]}
						{#each qubits as antiControlQubit}
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
									style="left: {gateOffset + (col + 0.5) * columnWidth}px;"
								>
									<div class="w-3 h-3 rounded-full border border-orange-600"></div>
								</div>
							{/if}
						{/each}
					{/each}

					<!-- Pending anti-control gate boxes (uncommitted anti-controls) -->
					{#each Array.from($pendingControls.entries()) as [col, qubits]}
						{#each qubits as controlQubit}
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
									style="left: {gateOffset + (col + 0.5) * columnWidth}px;"
								>
									<div class="w-3 h-3 rounded-full bg-yellow-600"></div>
								</div>
							{/if}
						{/each}
					{/each}
				</div>
			{/each}

			<!-- Ghost wire -->
			{#if showGhostWire}
				<div
					class="ghost-wire relative flex h-14 items-center"
					style={$isMobile ? `min-width: ${totalWidth}px` : ''}
					data-wire-row
					data-qubit={$circuitIR.registers.q}
					transition:slide={{ duration: 300 }}
				>
					<div
						class="wire-container absolute left-0 rounded-full right-0 top-1/2 h-0.5 -translate-y-1/2 transform opacity-30"
						style="background-color: var(--color-muted);"
					>
						{#each Array(MAX_COLUMNS) as _, colIndex}
							<div
								class="dropzone h-12 top-1/2 -translate-y-1/2 transform"
								class:dropzone-armed={$isMobile && $armedGate}
								style="left: {gateOffset + colIndex * columnWidth}px; width: {columnWidth}px"
							></div>
						{/each}
					</div>

					<div
						class="z-10 mr-2 flex h-11 w-11 select-none items-center justify-center rounded-full border-2 border-dashed border-ternary-3 bg-ternary-2 text-base text-white shadow-lg opacity-50"
					>
						|0⟩
					</div>

					<input
						type="text"
						value="Qubit {$circuitIR.registers.q}"
						disabled
						class="z-10 w-13 h-6 px-1.5 text-[11px] border border-dashed border-ternary-3 text-black text-center rounded-sm bg-purple-100 bg-opacity-30 shadow-lg opacity-50"
					/>
				</div>
			{/if}
		</div>
	</div>

	<!-- Board Context Menu -->
	{#if contextMenuVisible}
		<BoardContextMenu
			x={contextMenuX}
			y={contextMenuY}
			on:close={closeContextMenu}
			on:edit={() => {
				circuitDataModalContent.set(buildCanonicalString($circuitIR));
				showCircuitDataModal.set(true);
			}}
			on:copy={() => copyToClipboard(buildCanonicalString($circuitIR))}
			on:reset={resetAndClose}
		/>
	{/if}

	<!-- Gate Edit Context Menu -->
	{#if gateMenuVisible && gateMenuGate}
		<GateContextMenu gate={gateMenuGate} x={gateMenuX} y={gateMenuY} on:close={closeGateMenu} />
	{/if}
</div>

<style>
	.ghost-wire {
		opacity: 0.6;
	}
	.ghost-wire :global(.dropzone:hover) {
		background-color: rgba(168, 85, 247, 0.15);
		border-radius: 4px;
	}

	/* Pending control/anti-control boxes use the `.gate` class for positioning.
	   The committed gates moved to GateToken.svelte (with their own scoped
	   `.gate` rule), but these pending boxes still live here and need it too. */
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

	/* Mobile tap-to-place: highlight tappable cells while a gate is armed. */
	.dropzone-armed {
		background-color: rgba(168, 85, 247, 0.12);
		border: 1px dashed var(--color-secondary-2);
		border-radius: 4px;
	}
	.dropzone-armed:active {
		background-color: rgba(168, 85, 247, 0.3);
	}

	.qubit-label:hover {
		transform: scale(1.05);
		transition: transform 400ms ease-in-out;
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

	.wire-bloch-anchor {
		position: absolute;
		right: 0.5rem;
		top: 50%;
		transform: translateY(-50%);
		z-index: 20;
	}

	.selection-box {
		box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.1);
	}
</style>
