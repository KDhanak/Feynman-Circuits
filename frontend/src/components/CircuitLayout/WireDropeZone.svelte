<script lang="ts">
	import { tick } from 'svelte';
	import { circuit, circuitLayout, isDragging } from '$lib/stores';
	import type { CircuitState, GateInstance } from '$lib/stores';
	import {
		handleDrop,
		handleDragOver,
		handleGateDragStart,
		handleDoubleClick,
		removeGate,
		handleTouchStart,
		handleTouchMove,
		handleTouchEnd,
		triggerSimulation
	} from '$lib/dragDropUtils';
	import { updateQubitLabel } from '$lib/qubitLables';
	import Icon from '@iconify/svelte';
	import WireBloch from '../BlochSphere/WireBloch.svelte';

	let columnWidth = 58;
	let gateOffset = 120;
	let scrollContainer: HTMLDivElement | null = null;

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
		if (!boardEl) return;

		const boardRect = boardEl.getBoundingClientRect();
		const next: Connector[] = [];

		for (const control of $circuit.gates.filter((g) => g.gateType === 'CONTROL')) {
			const targets =
				control.targetQubits ?? (control.targetQubit !== undefined ? [control.targetQubit] : []);
			if (!targets.length) continue;

			const controlEl = boardEl.querySelector(
				`[data-col="${control.columnIndex}"][data-qubit="${control.qubit}"][data-type="CONTROL"]`
			);
			if (!controlEl) continue;

			const c = getCenter(controlEl, boardRect);

			for (const tq of targets) {
				const targetEl = boardEl.querySelector(
					`[data-col="${control.columnIndex}"][data-qubit="${tq}"]:not([data-type="CONTROL"])`
				);
				if (!targetEl) continue;

				const t = getCenter(targetEl, boardRect);
				next.push({
					key: `${control.id}-${tq}`,
					left: c.x,
					top: Math.min(c.y, t.y),
					height: Math.abs(c.y - t.y)
				});
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

	$: $circuit.gates, scheduleConnectorRecompute();

	$: wires = Array.from({ length: $circuit.numQubits }, (_, i) => ({
		id: `wire-${i}`,
		qubit: i
	}));

	$: showGhostWire = $isDragging && $circuit.numQubits < MAX_QUBITS;

	// Auto-scroll to bottom ONLY when dragging starts (to reveal ghost wire)
	$: if (showGhostWire && scrollContainer) {
		(async () => {
			await tick(); // Wait for DOM update (height change)
			await tick(); // Extra tick for safety
			setTimeout(() => {
				scrollContainer?.scrollTo({
					top: scrollContainer.scrollHeight,
					behavior: 'smooth'
				});
			}, 120); // Small delay so height transition finishes first
		})();
	}

	function removeQubitWire(qubitIndex: number) {
		const current = $circuit;
		if (current.numQubits <= 1) return;

		if (
			current.gates.some(
				(g) =>
					g.qubit === qubitIndex ||
					g.targetQubit === qubitIndex ||
					g.targetQubits?.includes(qubitIndex)
			)
		)
			return;

		const newNumQubits = current.numQubits - 1;

		const newGates = current.gates
			.filter((g) => g.qubit !== qubitIndex)
			.map((gate) => {
				const newQubit = gate.qubit > qubitIndex ? gate.qubit - 1 : gate.qubit;
				const newTargetQubit =
					gate.targetQubit !== undefined
						? gate.targetQubit > qubitIndex
							? gate.targetQubit - 1
							: gate.targetQubit
						: undefined;
				const newTargetQubits = gate.targetQubits
					? gate.targetQubits
							.filter((t) => t !== qubitIndex)
							.map((t) => (t > qubitIndex ? t - 1 : t))
					: undefined;

				return {
					...gate,
					qubit: newQubit,
					targetQubit: newTargetQubit,
					targetQubits: newTargetQubits
				} as GateInstance;
			});

		const newQubitLabels = current.qubitLabels
			? current.qubitLabels.filter((_, i) => i !== qubitIndex)
			: Array.from({ length: newNumQubits }, (_, i) => `Qubit ${i}`);

		const updatedCircuit: CircuitState = {
			...current,
			numQubits: newNumQubits,
			gates: newGates,
			qubitLabels: newQubitLabels
		};

		circuit.set(updatedCircuit);
		triggerSimulation(updatedCircuit);
	}
</script>

<div
	role="region"
	aria-label="Quantum Circuit Multi-Wire Drop Zone"
	class="w-[96%] relative mx-auto z-50"
	bind:this={boardEl}
>
	<!-- Fixed max height after 5 qubits -->
	<div
		class="border border-ternary-2 rounded-sm transition-all duration-300 ease-in-out overflow-hidden"
		style="height: {(Math.min($circuit.numQubits, 6) + (showGhostWire ? 1 : 0)) * 64 + 16}px;"
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
				<div class="relative flex h-16 items-center" data-qubit={wire.qubit}>
					<!-- Wire -->
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

					<!-- Qubit circle -->
					<div
						class={`qubit-circle mr-2 z-10 flex h-10 w-10 select-none items-center justify-center rounded-full border-2 bg-ternary-2 border-ternary-3 text-md text-white shadow-lg ${
							wire.qubit >= 1
								? 'cursor-pointer border-dotted active:border-solid active:border-amber-700 select-none'
								: 'cursor-default'
						}`}
						role="button"
						tabindex="0"
						on:dblclick={() => removeQubitWire(wire.qubit)}
					>
						|0⟩
					</div>

					<input
						type="text"
						value={$circuit.qubitLabels?.[wire.qubit] ?? `Qubit ${wire.qubit}`}
						on:input={(e) => updateQubitLabel(wire.qubit, (e.target as HTMLInputElement).value)}
						placeholder="Label"
						class="qubit-label z-10 w-15 h-6.5 px-1.5 cursor-text text-xs border border-ternary-3 text-black text-center rounded-md bg-purple-100 shadow-lg focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600"
					/>

					<!-- Gates -->
					{#each $circuit.gates as gate (gate.id)}
						{#if gate.qubit === wire.qubit}
							<div
								data-gate-id={gate.id}
								data-col={gate.columnIndex}
								data-qubit={gate.qubit}
								data-type={gate.gateType}
								role="button"
								aria-label={`Remove ${gate.gateType} gate...`}
								tabindex="0"
								draggable="true"
								on:dragstart={(e) => handleGateDragStart(e, gate.id)}
								on:keydown={(e) => e.key === 'Delete' && removeGate(gate.id)}
								on:dblclick={() => handleDoubleClick({ source: 'wire', gateId: gate.id })}
								on:touchstart={(e) =>
									handleTouchStart(e, { source: 'wire', gateId: gate.id, gateType: gate.gateType })}
								on:touchmove={handleTouchMove}
								on:touchend={handleTouchEnd}
								class="gate z-10 cursor-grab select-none rounded px-3 py-2 text-base border bg-white text-secondary-4 active:bg-secondary-3 border-secondary-4 active:text-white active:border-white shadow"
								style="left: {gateOffset + (gate.columnIndex + 0.5) * columnWidth}px;"
							>
								{#if gate.gateType === 'CONTROL'}
									<span class="inline-block w-3 h-3 rounded-full bg-secondary-4"></span>
								{:else if gate.gateType === 'MEASURE'}
									<span class="text-secondary-4">
										<Icon icon="si:meter-fill" width="20" height="20" />
									</span>
								{:else}
									<span class="gate-label">{gate.gateType}</span>
								{/if}
							</div>
						{/if}
					{/each}
				</div>
			{/each}

			<!-- Ghost wire (inside scrollable area, no height impact) -->
			{#if showGhostWire}
				<div class="ghost-wire relative flex h-14 items-center" data-qubit={$circuit.numQubits}>
					<div
						class="wire-container absolute left-0 rounded-full right-0 top-1/2 h-0.5 -translate-y-1/2 transform bg-gray-300 opacity-30"
					>
						{#each Array(MAX_COLUMNS) as _, colIndex}
							<div
								class="dropzone h-12 top-1/2 -translate-y-1/2 transform"
								aria-label={`Add qubit and drop gate at column ${colIndex + 1}`}
								role="button"
								tabindex="0"
								on:drop={(e) => handleDrop(e, colIndex, $circuit.numQubits)}
								on:dragover={handleDragOver}
								style="left: {gateOffset + colIndex * columnWidth}px; width: {columnWidth}px"
							></div>
						{/each}
					</div>

					<div
						class="z-10 mr-2 flex h-11 w-11 select-none items-center justify-center rounded-full border-2 border-dashed border-ternary-3 bg-ternary-2 text-md text-white shadow-lg opacity-50"
					>
						|0⟩
					</div>

					<input
						type="text"
						value="Qubit {$circuit.numQubits}"
						disabled
						class="z-10 w-15 h-7.5 px-1.5 text-xs border border-dashed border-ternary-3 text-black text-center rounded-md bg-purple-100 bg-opacity-30 shadow-lg opacity-50"
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
		background-color: rgba(100, 200, 255, 0.15);
	}

	.dropzone {
		position: absolute;
		top: 0;
		bottom: 0;
		background-color: transparent;
		transition: background-color 0.2s ease;
	}
	.dropzone:hover {
		background-color: rgba(255, 255, 255, 0.05);
	}

	.gate {
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
		z-index: 10;
		white-space: nowrap;
	}

	.gate.copying {
		box-shadow: 0 0 0 1px #22c55e; /* green glow when copying */
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

	::-webkit-scrollbar {
		width: 7px;
		height: 7px;
	}
	::-webkit-scrollbar-track {
		background: #1f2937;
		border-radius: 20px;
	}
	::-webkit-scrollbar-thumb {
		background: gray;
		border-radius: 20px;
	}
	::-webkit-scrollbar-thumb:hover {
		background: darkgray;
	}
</style>
