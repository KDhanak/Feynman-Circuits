<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { UnitaryOperation, MeasureOperation, CircuitOperation } from '$lib/IR/schema';
	import { isDragging } from '$lib/stores/uiStores';
	import {
		handleGateDragStart,
		handleDoubleClick,
		removeGate
	} from '$lib/circuit/dragDropUtils';
	import {
		selectedGateIds,
		handleGateSelection,
		toggleGateSelection,
		deleteSelectedGates
	} from '$lib/circuit/selection';
	import { isMobile } from '$lib/stores/isMobile';

	export let op: CircuitOperation;
	export let qubit: number;
	export let gateOffset: number;
	export let columnWidth: number;

	const dispatch = createEventDispatcher<{
		gatecontextmenu: { gate: UnitaryOperation; x: number; y: number };
	}>();

	const editableGates = ['rx', 'ry', 'rz', 'swap'];

	function onContextMenu(e: MouseEvent, gate: UnitaryOperation) {
		if (!editableGates.includes(gate.gate)) return;
		e.preventDefault();
		e.stopPropagation();
		dispatch('gatecontextmenu', { gate, x: e.clientX, y: e.clientY });
	}

	function onKeyDown(e: KeyboardEvent, gateId: string) {
		if (e.key === 'Delete') {
			if ($selectedGateIds.size > 0) {
				deleteSelectedGates();
			} else {
				removeGate(gateId);
			}
		}
	}
</script>

{#if op.kind === 'unitary'}
	{@const gate = op as UnitaryOperation}

	{#if gate.targets.includes(qubit)}
		<div
			data-gate-id={gate.id}
			data-col={gate.column}
			data-qubit={qubit}
			data-type="GATE"
			role="button"
			aria-label={`Remove ${gate.gate} gate`}
			tabindex="0"
			draggable="true"
			on:dragstart={(e) => handleGateDragStart(e, gate.id)}
			on:dragend={() => isDragging.set(false)}
			on:click={(e) => ($isMobile ? toggleGateSelection(gate.id) : handleGateSelection(gate.id, e))}
			on:keydown={(e) => onKeyDown(e, gate.id)}
			on:dblclick={() => handleDoubleClick({ source: 'wire', gateId: gate.id })}
			on:contextmenu={(e) => onContextMenu(e, gate)}
			class={`gate z-10 cursor-grab select-none rounded-sm border border-ternary-1 active:text-white active:border-white shadow transition-colors duration-100 flex items-center justify-center ${
				gate.gate === 'swap'
					? `bg-transparent border-dashed border-ternary-1 text-ternary-1 active:bg-secondary-3 active:text-white font-extralight ${$isMobile ? 'h-9 w-8' : 'h-11 w-10'}`
					: gate.gate === 'x'
						? `bg-surface text-text active:bg-ternary-1 ${$isMobile ? 'px-1.5 py-1.5' : 'px-2 py-2'}`
						: `bg-surface text-text active:bg-ternary-1 ${$isMobile ? 'px-2.5 py-1.5 text-sm' : 'px-3 py-2 text-base'}`
			}`}
			class:selected={$selectedGateIds.has(gate.id)}
			style="left: {gateOffset + (gate.column + 0.5) * columnWidth}px;"
		>
			{#if gate.gate === 'swap'}
				<span class={$isMobile ? 'text-[20px]' : 'text-[32px]'}>×</span>
			{:else if gate.gate === 'x'}
				<svg viewBox="0 0 28 28" width={$isMobile ? '16' : '20'} height={$isMobile ? '16' : '20'} aria-hidden="true">
					<circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" stroke-width="2" />
					<line x1="2" y1="14" x2="26" y2="14" stroke="currentColor" stroke-width="2" />
					<line x1="14" y1="2" x2="14" y2="26" stroke="currentColor" stroke-width="2" />
				</svg>
			{:else}
				{gate.gate.toUpperCase()}
			{/if}
		</div>
	{/if}

	{#if gate.controls.includes(qubit)}
		<div
			data-gate-id={gate.id}
			data-col={gate.column}
			data-qubit={qubit}
			data-type="CONTROL"
			role="button"
			aria-label="Control gate"
			tabindex="0"
			draggable="true"
			on:dragstart={(e) => handleGateDragStart(e, gate.id, 'CONTROL', qubit)}
			on:dragend={() => isDragging.set(false)}
			on:click={(e) => ($isMobile ? toggleGateSelection(gate.id) : handleGateSelection(gate.id, e))}
			on:keydown={(e) => onKeyDown(e, gate.id)}
			on:dblclick={() =>
				handleDoubleClick({ source: 'wire', gateId: gate.id, gateType: 'CONTROL', qubit })}
			class={`gate z-10 cursor-grab select-none rounded-sm ${$isMobile ? 'h-8 w-8' : 'h-11 w-10'} text-sm border border-ternary-1 bg-surface active:bg-ternary-1 active:border-white shadow transition-colors duration-100 flex items-center justify-center`}
			style="left: {gateOffset + (gate.column + 0.5) * columnWidth}px;"
		>
			<div class="w-3 h-3 rounded-full bg-text"></div>
		</div>
	{/if}

	{#if gate.antiControls.includes(qubit)}
		<div
			data-gate-id={gate.id}
			data-col={gate.column}
			data-qubit={qubit}
			data-type="ANTI_CONTROL"
			role="button"
			aria-label="Anti-control gate"
			tabindex="0"
			draggable="true"
			on:dragstart={(e) => handleGateDragStart(e, gate.id, 'ANTI_CONTROL', qubit)}
			on:dragend={() => isDragging.set(false)}
			on:click={(e) => ($isMobile ? toggleGateSelection(gate.id) : handleGateSelection(gate.id, e))}
			on:keydown={(e) => onKeyDown(e, gate.id)}
			on:dblclick={() =>
				handleDoubleClick({ source: 'wire', gateId: gate.id, gateType: 'ANTI_CONTROL', qubit })}
			class={`gate z-10 cursor-grab select-none rounded-sm ${$isMobile ? 'h-8 w-8' : 'h-11 w-10'} text-sm border border-ternary-1 bg-surface active:bg-ternary-1 active:border-white shadow transition-colors duration-100 flex items-center justify-center`}
			style="left: {gateOffset + (gate.column + 0.5) * columnWidth}px;"
		>
			<div class="w-3 h-3 rounded-full border border-text"></div>
		</div>
	{/if}

{:else if op.kind === 'measure'}
	{@const measureOp = op as MeasureOperation}

	{#if (measureOp.targets as number[]).includes(qubit)}
		<div
			data-gate-id={measureOp.id}
			data-col={measureOp.column}
			data-qubit={qubit}
			data-type="GATE"
			role="button"
			aria-label="Remove measure gate"
			tabindex="0"
			draggable="true"
			on:dragstart={(e) => handleGateDragStart(e, measureOp.id)}
			on:dragend={() => isDragging.set(false)}
			on:click={(e) =>
				$isMobile ? toggleGateSelection(measureOp.id) : handleGateSelection(measureOp.id, e)}
			on:keydown={(e) => e.key === 'Delete' && removeGate(measureOp.id)}
			on:dblclick={() => handleDoubleClick({ source: 'wire', gateId: measureOp.id })}
			class="gate z-10 cursor-grab select-none rounded-sm px-3 py-2 text-base border bg-orange-100 text-orange-700 active:bg-orange-400 border-orange-300 active:text-white active:border-white shadow transition-colors duration-100"
			style="left: {gateOffset + (measureOp.column + 0.5) * columnWidth}px;"
		>
			M
		</div>
	{/if}
{/if}

<style>
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
</style>
