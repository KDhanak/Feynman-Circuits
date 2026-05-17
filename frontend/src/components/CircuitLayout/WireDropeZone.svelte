<script lang="ts">
	import type { CircuitOperation, UnitaryOperation } from '$lib/IR/schema';
	import { tick } from 'svelte';
	import { circuitLayout, isDragging } from '$lib/stores';
	import { circuitIR } from '$lib/IR/stores';
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
		pendingControls
	} from '$lib/dragDropUtils';
	import { updateQubitLabel } from '$lib/qubitLables';
	import WireBloch from '../BlochSphere/WireBloch.svelte';

	let columnWidth = 58;
	let gateOffset = 120;
	let scrollContainer: HTMLDivElement | null = null;
	let hoveredWire: number | null = null;

	const MAX_COLUMNS = 29;
	const MAX_QUBITS = 8;

	$circuitLayout;
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

		// Iterate unitary operations with controls
		for (const op of $circuitIR.operations) {
			if (op.kind !== 'unitary') continue;
			const unitOp = op as UnitaryOperation;
			if (unitOp.controls.length === 0) continue;

			// For each target qubit
			for (const targetQubit of unitOp.targets) {
				const targetEl = boardEl.querySelector(
					`[data-col="${unitOp.column}"][data-qubit="${targetQubit}"]:not([data-type="CONTROL"])`
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
						key: `${unitOp.id}-${ctrl}-${targetQubit}`,
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

	$: $circuitIR.operations, $circuitLayout, scheduleConnectorRecompute();

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
			if (op.kind === 'unitary' && (op as UnitaryOperation).controls.includes(qubitIndex))
				return true;
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
				const remapQubits = (qs: number[]) => qs.map(remapQubit).filter((q) => q !== qubitIndex);

				if (op.kind === 'unitary') {
					return {
						...op,
						targets: remapQubits((op as UnitaryOperation).targets),
						controls: remapQubits((op as UnitaryOperation).controls)
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
</script>

<div
	role="region"
	aria-label="Quantum Circuit Multi-Wire Drop Zone"
	class="w-[96%] relative mx-auto z-50"
	bind:this={boardEl}
>
	<div
		class="border border-ternary-2 rounded-sm transition-all duration-300 ease-in-out overflow-hidden"
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
						class="wire-container absolute left-0 rounded-full right-0 top-1/2 h-0.5 -translate-y-1/2 transform bg-gray-300"
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
							class={`flex h-10 w-10 select-none items-center justify-center rounded-full border-2 bg-ternary-2 border-ternary-3 text-base text-white shadow-lg ${
								wire.qubit >= 1
									? 'cursor-pointer border-dotted active:border-solid active:border-amber-700'
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
						class="qubit-label z-10 w-15 h-6.5 px-1.5 cursor-text text-xs border border-ternary-3 text-black text-center rounded-sm bg-purple-100 shadow-lg focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600"
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
									on:keydown={(e) => e.key === 'Delete' && removeGate(gate.id)}
									on:dblclick={() => handleDoubleClick({ source: 'wire', gateId: gate.id })}
									on:touchstart={(e) =>
										handleTouchStart(e, { source: 'wire', gateId: gate.id, gateType: gate.gate })}
									on:touchmove={handleTouchMove}
									on:touchend={handleTouchEnd}
									class="gate z-10 cursor-grab select-none rounded-sm px-3 py-2 text-base border bg-white text-secondary-4 hover:bg-secondary-1 hover:border-secondary-3 active:bg-secondary-3 border-secondary-4 active:text-white active:border-white shadow transition-colors duration-100"
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
									on:keydown={(e) => e.key === 'Delete' && removeGate(gate.id)}
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
						{/if}
					{/each}

					<!-- Pending control gate boxes (uncommitted controls) -->
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
									on:keydown={(e) => e.key === 'Delete' && pendingControls.update(map => {
										const next = new Map(map);
										const qubits = next.get(col) ?? [];
										next.set(col, qubits.filter(q => q !== controlQubit));
										if (next.get(col)?.length === 0) next.delete(col);
										return next;
									})}
									class="gate z-10 select-none rounded-sm h-11 w-10 py-3 text-base border bg-yellow-300 hover:bg-yellow-400 border-yellow-500 shadow transition-colors duration-100 opacity-75 flex items-center justify-center"
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
						class="wire-container absolute left-0 rounded-full right-0 top-1/2 h-0.5 -translate-y-1/2 transform bg-gray-300 opacity-30"
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
		box-shadow: 0 0 0 1px #22c55e;
		transition: all 0.15s ease;
	}

	.qubit-label:hover {
		transform: scale(1.05);
		transition: transform 400ms ease-in-out;
	}

	.wire-bloch-anchor {
		position: absolute;
		right: 0.5rem;
		top: 50%;
		transform: translateY(-50%);
		z-index: 20;
	}
</style>
