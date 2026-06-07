<script lang="ts">
	import type { UnitaryOperation, MeasureOperation } from '$lib/IR/schema';
	import { tick, onMount } from 'svelte';
	import { simulationResult, circuitIR } from '$lib/IR/stores';
	import {
		circuitLayout,
		isDragging,
		showCircuitDataModal,
		circuitDataModalContent
	} from '$lib/stores/uiStores';
	import {
		handleDrop,
		handleDragOver,
		handleGateDragStart,
		handleDoubleClick,
		removeGate,
		handleTouchStart,
		handleTouchMove,
		handleTouchEnd,
		triggerSimulation,
		pendingControls,
		pendingAntiControls
	} from '$lib/circuit/dragDropUtils';
	import { updateQubitLabel } from '$lib/circuit/qubitLables';
	import { buildCanonicalString } from '$lib/circuit/circuitDataModal';
	import { copyToClipboard } from '$lib/circuit/circuitActions';
	import WireBloch from '../BlochSphere/WireBloch.svelte';
	import Icon from '@iconify/svelte';
	import { MAX_COLUMNS, MAX_QUBITS } from '$lib/utils/constants';

	let columnWidth: number;
	let gateOffset: number;
	let scrollContainer: HTMLDivElement | null = null;
	let hoveredWire: number | null = null;
	let selectedGateIds = new Set<string>();
	let contextMenuVisible = false;
	let contextMenuX = 0;
	let contextMenuY = 0;
	let isDragSelecting = false;
	let dragStart: { x: number; y: number } | null = null;
	let dragCurrent: { x: number; y: number } | null = null;
	let gateRectCache: Map<string, DOMRect> = new Map();
	let dragRafId: number | null = null;

	$: ({ columnWidth, gateOffset } = $circuitLayout);

	type Connector = { key: string; left: number; top: number; height: number };
	let connectors: Connector[] = [];
	let boardEl: HTMLDivElement | null = null;
	let rafId: number | null = null;

	function getCenter(el: Element, boardRect: DOMRect) {
		const r = (el as HTMLElement).getBoundingClientRect();
		return {
			x: r.left - boardRect.left + r.width / 2,
			y: r.top - boardRect.top + r.height / 2
		};
	}

	async function recomputeConnectors() {
		await tick();
		await tick();
		if (!boardEl) return;

		const boardRect = boardEl.getBoundingClientRect();
		const next: Connector[] = [];

		// Iterate unitary operations with controls or anti-controls
		for (const op of $circuitIR.operations) {
			if (op.kind !== 'unitary') continue;
			const unitOp = op as UnitaryOperation;
			if (unitOp.controls.length === 0 && unitOp.antiControls.length === 0) continue;

			// For each target qubit
			for (const targetQubit of unitOp.targets) {
				const targetEl = boardEl.querySelector(
					`[data-col="${unitOp.column}"][data-qubit="${targetQubit}"]:not([data-type="CONTROL"]):not([data-type="ANTI_CONTROL"])`
				);
				if (!targetEl) continue;

				const t = getCenter(targetEl, boardRect);

				// Draw connector from each control to this target
				for (const ctrl of unitOp.controls) {
					const controlEl = boardEl.querySelector(
						`[data-col="${unitOp.column}"][data-qubit="${ctrl}"][data-type="CONTROL"]`
					);
					if (!controlEl) continue;

					const c = getCenter(controlEl, boardRect);

					next.push({
						key: `${unitOp.id}-ctrl-${ctrl}-${targetQubit}`,
						left: c.x,
						top: Math.min(c.y, t.y),
						height: Math.abs(c.y - t.y)
					});
				}

				// Draw connector from each anti-control to this target
				for (const antiCtrl of unitOp.antiControls) {
					const antiControlEl = boardEl.querySelector(
						`[data-col="${unitOp.column}"][data-qubit="${antiCtrl}"][data-type="ANTI_CONTROL"]`
					);
					if (!antiControlEl) continue;

					const c = getCenter(antiControlEl, boardRect);

					next.push({
						key: `${unitOp.id}-antictrl-${antiCtrl}-${targetQubit}`,
						left: c.x,
						top: Math.min(c.y, t.y),
						height: Math.abs(c.y - t.y)
					});
				}
			}
		}

		connectors = next;
	}

	function scheduleConnectorRecompute() {
		if (typeof window === 'undefined') return;
		if (rafId !== null) cancelAnimationFrame(rafId);
		rafId = requestAnimationFrame(() => {
			recomputeConnectors();
			rafId = null;
		});
	}

	$: ($circuitIR.operations, $circuitLayout, scheduleConnectorRecompute());

	$: wires = Array.from({ length: $circuitIR.registers.q }, (_, i) => ({
		id: `wire-${i}`,
		qubit: i
	}));

	$: showGhostWire = $isDragging && $circuitIR.registers.q < MAX_QUBITS;

	$: if (showGhostWire && scrollContainer) {
		(async () => {
			await tick();
			await tick();
			setTimeout(() => {
				scrollContainer?.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
			}, 350);
		})();
	}

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
	}

	function closeContextMenu() {
		contextMenuVisible = false;
	}

	function handleGateSelection(gateId: string, event: MouseEvent) {
		if (event.ctrlKey || event.metaKey) {
			// Ctrl/Cmd+Click: toggle selection
			if (selectedGateIds.has(gateId)) {
				selectedGateIds.delete(gateId);
			} else {
				selectedGateIds.add(gateId);
			}
			selectedGateIds = selectedGateIds; // trigger reactivity
		} else {
			// Regular click: select only this gate
			selectedGateIds.clear();
			selectedGateIds.add(gateId);
			selectedGateIds = selectedGateIds; // trigger reactivity
		}
	}

	function handleBoardMouseDown(e: MouseEvent) {
		const target = e.target as HTMLElement;
		// Only start drag selection if clicking on empty space (not on gates, wires, or labels)
		if (
			target.classList.contains('gate') ||
			target.classList.contains('wire-container') ||
			target.classList.contains('qubit-label')
		) {
			return;
		}

		isDragSelecting = true;
		dragStart = { x: e.clientX, y: e.clientY };
		dragCurrent = { x: e.clientX, y: e.clientY };

		// Precompute gate bounding rects at start of drag
		gateRectCache.clear();
		document.querySelectorAll('[data-gate-id]').forEach((gate) => {
			const gateId = gate.getAttribute('data-gate-id');
			if (gateId) {
				gateRectCache.set(gateId, (gate as HTMLElement).getBoundingClientRect());
			}
		});
	}

	function handleBoardMouseMove(e: MouseEvent) {
		if (!isDragSelecting || !dragStart) return;

		if (dragRafId !== null) cancelAnimationFrame(dragRafId);
		dragRafId = requestAnimationFrame(() => {
			dragCurrent = { x: e.clientX, y: e.clientY };
			dragRafId = null;
		});
	}

	function handleBoardMouseUp(e: MouseEvent) {
		if (!isDragSelecting || !dragStart || !dragCurrent) {
			isDragSelecting = false;
			return;
		}

		const minX = Math.min(dragStart.x, dragCurrent.x);
		const maxX = Math.max(dragStart.x, dragCurrent.x);
		const minY = Math.min(dragStart.y, dragCurrent.y);
		const maxY = Math.max(dragStart.y, dragCurrent.y);

		// If drag rectangle is too small, treat as click on empty space
		if (maxX - minX < 5 || maxY - minY < 5) {
			// Clear selection unless Ctrl/Cmd is held
			if (!(e.ctrlKey || e.metaKey)) {
				selectedGateIds.clear();
				selectedGateIds = selectedGateIds;
			}
			isDragSelecting = false;
			dragStart = null;
			dragCurrent = null;
			gateRectCache.clear();
			return;
		}

		// Use cached rects computed at mousedown
		const selectedInDrag = new Set<string>();

		gateRectCache.forEach((rect, gateId) => {
			if (rect.right > minX && rect.left < maxX && rect.bottom > minY && rect.top < maxY) {
				selectedInDrag.add(gateId);
			}
		});

		// If Ctrl/Cmd is held, add to existing selection; otherwise replace
		if (e.ctrlKey || e.metaKey) {
			selectedInDrag.forEach((id) => selectedGateIds.add(id));
		} else {
			selectedGateIds = selectedInDrag;
		}
		selectedGateIds = selectedGateIds; // trigger reactivity

		isDragSelecting = false;
		dragStart = null;
		dragCurrent = null;
		gateRectCache.clear();
	}

	function deleteSelectedGates() {
		selectedGateIds.forEach((gateId) => removeGate(gateId));
		selectedGateIds.clear();
		selectedGateIds = selectedGateIds; // trigger reactivity
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
			const contextMenu = document.querySelector('[role="menu"]');
			if (contextMenuVisible && contextMenu && !contextMenu.contains(target)) {
				closeContextMenu();
			}
		};

		const handleDeleteKey = (e: KeyboardEvent) => {
			if (e.key === 'Delete' && selectedGateIds.size > 0) {
				e.preventDefault();
				deleteSelectedGates();
			}
		};

		document.addEventListener('click', handleClickOutside);
		document.addEventListener('keydown', handleDeleteKey);
		return () => {
			document.removeEventListener('click', handleClickOutside);
			document.removeEventListener('keydown', handleDeleteKey);
		};
	});
</script>

<div
	role="none"
	class="w-full relative mx-auto z-50 select-none"
	bind:this={boardEl}
	on:contextmenu={handleContextMenu}
	on:mousedown={handleBoardMouseDown}
	on:mousemove={handleBoardMouseMove}
	on:mouseup={handleBoardMouseUp}
	on:mouseleave={() => {
		if (dragRafId !== null) cancelAnimationFrame(dragRafId);
		isDragSelecting = false;
		dragStart = null;
		dragCurrent = null;
		gateRectCache.clear();
	}}
	on:click={(e) => {
		closeContextMenu();
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
			selectedGateIds.clear();
			selectedGateIds = selectedGateIds; // trigger reactivity
		}
	}}
	on:keydown={(e) => {
		if (e.key === 'Escape') closeContextMenu();
	}}
>
	<!-- Drag selection box -->
	{#if isDragSelecting && dragStart && dragCurrent}
		{@const minX = Math.min(dragStart.x, dragCurrent.x)}
		{@const maxX = Math.max(dragStart.x, dragCurrent.x)}
		{@const minY = Math.min(dragStart.y, dragCurrent.y)}
		{@const maxY = Math.max(dragStart.y, dragCurrent.y)}
		<div
			class="selection-box fixed pointer-events-none border border-blue-400 border-dashed"
			style="left: {minX}px; top: {minY}px; width: {maxX - minX}px; height: {maxY -
				minY}px; z-index: 100; background-color: rgba(59, 130, 246, 0.5);"
		></div>
	{/if}
	<div
		class="rounded-sm transition-all duration-300 ease-in-out overflow-hidden"
		style="height: {(Math.min($circuitIR.registers.q, 6) + (showGhostWire ? 1 : 0)) * 64 + 16}px;"
	>
		<div class="space-y-1 p-2 overflow-y-auto overflow-x-hidden h-full" bind:this={scrollContainer}>
			<!-- Connectors -->
			{#each connectors as line (line.key)}
				<div
					class="absolute w-0.5 bg-ternary-1 pointer-events-none z-10"
					style="left: {line.left}px; top: {line.top}px; height: {line.height}px; transform: translateX(-50%);"
				></div>
			{/each}

			<!-- Real wires -->
			{#each wires as wire (wire.id)}
				<div
					role="row"
					tabindex="-1"
					class="relative flex h-16 items-center"
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
								on:drop={(e) => handleDrop(e, colIndex, wire.qubit)}
								on:dragover={handleDragOver}
								role="button"
								aria-label={`Drop gate here at column ${colIndex + 1}`}
								tabindex="0"
								style="left: {gateOffset + colIndex * columnWidth}px; width: {columnWidth}px"
							></div>
						{/each}
						<div class="wire-bloch-anchor">
							<WireBloch qubit={wire.qubit} />
						</div>
					</div>

					<!-- Qubit circle with hover-reveal delete button -->
					<div class="relative mr-2 z-10 shrink-0">
						<div
							class={`flex h-10 w-10 select-none items-center justify-center rounded-full border-2 text-base shadow-sm ${
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
						class={`qubit-label z-10 w-15 h-6.5 px-1.5 cursor-text text-xs border text-center rounded-sm shadow-sm focus:outline-none focus:ring-1 select-auto ${
							$simulationResult?.measuredQubits?.includes(wire.qubit)
								? 'bg-orange-100 border-orange-300 text-orange-900 focus:ring-orange-600 focus:border-orange-600'
								: 'border-ternary-3 text-black bg-purple-100 focus:ring-purple-600 focus:border-purple-600'
						}`}
					/>

					<!-- Gates -->
					{#each $circuitIR.operations as op (op.id)}
						{#if op.kind === 'unitary'}
							{@const gate = op as UnitaryOperation}

							{#if gate.targets.includes(wire.qubit)}
								<div
									data-gate-id={gate.id}
									data-col={gate.column}
									data-qubit={wire.qubit}
									data-type="GATE"
									role="button"
									aria-label={`Remove ${gate.gate} gate`}
									tabindex="0"
									draggable="true"
									on:dragstart={(e) => handleGateDragStart(e, gate.id)}
									on:dragend={() => isDragging.set(false)}
									on:click={(e) => handleGateSelection(gate.id, e)}
									on:keydown={(e) => {
										if (e.key === 'Delete') {
											if (selectedGateIds.size > 0) {
												deleteSelectedGates();
											} else {
												removeGate(gate.id);
											}
										}
									}}
									on:dblclick={() => handleDoubleClick({ source: 'wire', gateId: gate.id })}
									on:touchstart={(e) =>
										handleTouchStart(e, { source: 'wire', gateId: gate.id, gateType: gate.gate })}
									on:touchmove={handleTouchMove}
									on:touchend={handleTouchEnd}
									class="gate z-10 cursor-grab select-none rounded-sm px-3 py-2 text-base border bg-white text-secondary-4 active:bg-secondary-3 border-secondary-4 active:text-white active:border-white shadow transition-colors duration-100"
									class:selected={selectedGateIds.has(gate.id)}
									style="left: {gateOffset + (gate.column + 0.5) * columnWidth}px;"
								>
									{gate.gate.toUpperCase()}
								</div>
							{/if}

							{#if gate.controls.includes(wire.qubit)}
								<div
									data-gate-id={gate.id}
									data-col={gate.column}
									data-qubit={wire.qubit}
									data-type="CONTROL"
									role="button"
									aria-label="Control gate"
									tabindex="0"
									draggable="true"
									on:dragstart={(e) => handleGateDragStart(e, gate.id)}
									on:dragend={() => isDragging.set(false)}
									on:click={(e) => handleGateSelection(gate.id, e)}
									on:keydown={(e) => {
										if (e.key === 'Delete') {
											if (selectedGateIds.size > 0) {
												deleteSelectedGates();
											} else {
												removeGate(gate.id);
											}
										}
									}}
									on:dblclick={() => handleDoubleClick({ source: 'wire', gateId: gate.id })}
									on:touchstart={(e) =>
										handleTouchStart(e, { source: 'wire', gateId: gate.id, gateType: 'CONTROL' })}
									on:touchmove={handleTouchMove}
									on:touchend={handleTouchEnd}
									class="gate z-10 cursor-grab select-none rounded-sm h-11 w-10 text-base border bg-white active:bg-secondary-3 active:border-white shadow transition-colors duration-100 flex items-center justify-center"
									style="left: {gateOffset + (gate.column + 0.5) * columnWidth}px;"
								>
									<div class="w-3 h-3 rounded-full bg-secondary-4"></div>
								</div>
							{/if}

							{#if gate.antiControls.includes(wire.qubit)}
								<div
									data-gate-id={gate.id}
									data-col={gate.column}
									data-qubit={wire.qubit}
									data-type="ANTI_CONTROL"
									role="button"
									aria-label="Anti-control gate"
									tabindex="0"
									draggable="true"
									on:dragstart={(e) => handleGateDragStart(e, gate.id)}
									on:dragend={() => isDragging.set(false)}
									on:click={(e) => handleGateSelection(gate.id, e)}
									on:keydown={(e) => {
										if (e.key === 'Delete') {
											if (selectedGateIds.size > 0) {
												deleteSelectedGates();
											} else {
												removeGate(gate.id);
											}
										}
									}}
									on:dblclick={() => handleDoubleClick({ source: 'wire', gateId: gate.id })}
									on:touchstart={(e) =>
										handleTouchStart(e, {
											source: 'wire',
											gateId: gate.id,
											gateType: 'ANTI_CONTROL'
										})}
									on:touchmove={handleTouchMove}
									on:touchend={handleTouchEnd}
									class="gate z-10 cursor-grab select-none rounded-sm h-11 w-10 text-base border bg-white active:bg-secondary-3 active:border-white shadow transition-colors duration-100 flex items-center justify-center"
									style="left: {gateOffset + (gate.column + 0.5) * columnWidth}px;"
								>
									<div class="w-3 h-3 rounded-full border border-secondary-4"></div>
								</div>
							{/if}
						{:else if op.kind === 'measure'}
							{@const measureOp = op as MeasureOperation}

							{#if (measureOp.targets as number[]).includes(wire.qubit)}
								<div
									data-gate-id={measureOp.id}
									data-col={measureOp.column}
									data-qubit={wire.qubit}
									data-type="GATE"
									role="button"
									aria-label="Remove measure gate"
									tabindex="0"
									draggable="true"
									on:dragstart={(e) => handleGateDragStart(e, measureOp.id)}
									on:dragend={() => isDragging.set(false)}
									on:keydown={(e) => e.key === 'Delete' && removeGate(measureOp.id)}
									on:dblclick={() => handleDoubleClick({ source: 'wire', gateId: measureOp.id })}
									on:touchstart={(e) =>
										handleTouchStart(e, {
											source: 'wire',
											gateId: measureOp.id,
											gateType: 'MEASURE'
										})}
									on:touchmove={handleTouchMove}
									on:touchend={handleTouchEnd}
									class="gate z-10 cursor-grab select-none rounded-sm px-3 py-2 text-base border bg-orange-100 text-orange-700 active:bg-orange-400 border-orange-300 active:text-white active:border-white shadow transition-colors duration-100"
									style="left: {gateOffset + (measureOp.column + 0.5) * columnWidth}px;"
								>
									M
								</div>
							{/if}
						{/if}
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
									class="gate z-10 select-none rounded-sm h-11 w-10 py-3 text-base border bg-orange-200 shadow transition-colors duration-100 opacity-75 flex items-center justify-center"
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
									class="gate z-10 select-none rounded-sm h-11 w-10 py-3 text-base border bg-yellow-300 border-yellow-500 shadow transition-colors duration-100 opacity-75 flex items-center justify-center"
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
				<div class="ghost-wire relative flex h-14 items-center" data-qubit={$circuitIR.registers.q}>
					<div
						class="wire-container absolute left-0 rounded-full right-0 top-1/2 h-0.5 -translate-y-1/2 transform opacity-30"
						style="background-color: var(--color-muted);"
					>
						{#each Array(MAX_COLUMNS) as _, colIndex}
							<div
								class="dropzone h-12 top-1/2 -translate-y-1/2 transform"
								aria-label={`Add qubit and drop gate at column ${colIndex + 1}`}
								role="button"
								tabindex="0"
								on:drop={(e) => handleDrop(e, colIndex, $circuitIR.registers.q)}
								on:dragover={handleDragOver}
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
						class="z-10 w-15 h-7.5 px-1.5 text-xs border border-dashed border-ternary-3 text-black text-center rounded-sm bg-purple-100 bg-opacity-30 shadow-lg opacity-50"
					/>
				</div>
			{/if}
		</div>
	</div>

	<!-- Context Menu -->
	{#if contextMenuVisible}
		<div
			class="ctx-menu z-100"
			style="left: {contextMenuX}px; top: {contextMenuY}px;"
			role="menu"
			tabindex="0"
			on:click|stopPropagation={() => {}}
			on:keydown={(e) => {
				if (e.key === 'Escape') closeContextMenu();
			}}
		>
			<button
				type="button"
				role="menuitem"
				class="ctx-menu-item rounded-t-sm"
				on:click={() => {
					closeContextMenu();
					circuitDataModalContent.set(buildCanonicalString($circuitIR));
					showCircuitDataModal.set(true);
				}}
			>
				<Icon icon="material-symbols:edit-outline" width="16" height="16" />
				Edit Circuit
			</button>
			<button
				type="button"
				role="menuitem"
				class="ctx-menu-item"
				on:click={() => copyToClipboard(buildCanonicalString($circuitIR))}
			>
				<Icon icon="material-symbols:content-copy" width="16" height="16" />
				Copy Circuit
			</button>
			<button
				type="button"
				role="menuitem"
				class="ctx-menu-item-danger rounded-b-sm"
				on:click={resetAndClose}
			>
				<Icon icon="material-symbols:restart-alt" width="16" height="16" />
				Reset Circuit
			</button>
		</div>
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

	.gate {
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
		z-index: 10;
		white-space: nowrap;
	}

	.gate.copying {
		box-shadow: 0 0 0 2px #3bc96f;
		outline: 2px solid #28ff33;
		outline-offset: -1px;
	}

	.gate.selected {
		box-shadow: 0 0 0 3px #3b82f6;
		outline: 2px solid #1e40af;
		outline-offset: -1px;
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
