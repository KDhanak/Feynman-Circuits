<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { get } from 'svelte/store';
	import type { UnitaryOperation, MeasureOperation, CircuitOperation } from '$lib/IR/schema';
	import { isDragging } from '$lib/stores/uiStores';
	import {
		handleGateDragStart,
		handleDoubleClick,
		removeGate,
		armGateForMove,
		disarmGate
	} from '$lib/circuit/dragDropUtils';
	import {
		selectedGateIds,
		handleGateSelection,
		toggleGateSelection,
		deleteSelectedGates
	} from '$lib/circuit/selection';
	import { isMobile } from '$lib/stores/isMobile';
	import { PARAMETRIC_GATE_IDS } from '$lib/quantum/gates';
	import { createLongPress } from '$lib/circuit/touchUtils';
	import { formatRadiansAsPi } from '$lib/utils/piMath';

	export let op: CircuitOperation;
	export let qubit: number;
	export let columnWidth: number;

	const dispatch = createEventDispatcher<{
		gatecontextmenu: { gate: UnitaryOperation; x: number; y: number };
	}>();

	// Editable = anything with an angle (parametric) plus swap (target picker).
	const editableGates = [...PARAMETRIC_GATE_IDS, 'swap'];

	// The angle a parametric gate carries, shown on the token so the circuit can
	// be read without opening each gate's editor. Rendered as a fraction of π
	// ("π/2"), which is how the editor takes it too. Presentation only — the value
	// already lives in the operation's `params`.
	const isParametric = (g: string) => PARAMETRIC_GATE_IDS.includes(g as never);
	const angleOf = (g: UnitaryOperation) => formatRadiansAsPi(g.params[0] ?? 0);

	// Hover/long-press text spelling out what a tap-to-edit would change.
	function editableSummary(g: UnitaryOperation): string | undefined {
		if (isParametric(g.gate)) return `${g.gate.toUpperCase()} angle ${angleOf(g)}`;
		if (g.gate === 'swap') return `SWAP q${g.targets[0]} ↔ q${g.targets[1] ?? '?'}`;
		return undefined;
	}

	function onContextMenu(e: MouseEvent, gate: UnitaryOperation) {
		if (!editableGates.includes(gate.gate)) return;
		e.preventDefault();
		e.stopPropagation();
		// Android fires `contextmenu` partway through a long press. Swallow it and
		// let the long-press timer open the menu, so touch takes exactly one path.
		if (longPress.isTouchActive()) return;
		dispatch('gatecontextmenu', { gate, x: e.clientX, y: e.clientY });
	}

	// Mobile: a tap both toggles the gate in the selection (which drives the
	// delete button) and arms it for a tap-to-move — the two follow-up actions
	// don't collide, since one is a tap on the trash button and the other a tap on
	// the board. Arming only when the tapped gate is the whole selection keeps
	// multi-select-to-delete working: adding a second gate drops back to delete-only.
	function onMobileTap(gateId: string, gateType?: string, qubit?: number) {
		toggleGateSelection(gateId);
		const selected = get(selectedGateIds);
		if (selected.size === 1 && selected.has(gateId)) armGateForMove(gateId, gateType, qubit);
		else disarmGate();
	}

	// Touch has no right-click, so hold an editable gate to open the same editor.
	$: editableOp = op.kind === 'unitary' && editableGates.includes(op.gate) ? op : null;

	const longPress = createLongPress({
		enabled: () => editableOp !== null,
		onLongPress: (target) => {
			if (!editableOp) return;
			// Anchor under the gate rather than at the touch point, which is covered
			// by the user's finger. Matches where a freshly dropped gate opens.
			const rect = target.getBoundingClientRect();
			dispatch('gatecontextmenu', { gate: editableOp, x: rect.left, y: rect.bottom + 6 });
		}
	});

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
			aria-label={editableSummary(gate)
				? `Remove ${gate.gate} gate, ${editableSummary(gate)}`
				: `Remove ${gate.gate} gate`}
			title={editableSummary(gate)}
			tabindex="0"
			draggable="true"
			on:dragstart={(e) => handleGateDragStart(e, gate.id)}
			on:dragend={() => isDragging.set(false)}
			on:click={(e) => ($isMobile ? onMobileTap(gate.id) : handleGateSelection(gate.id, e))}
			on:keydown={(e) => onKeyDown(e, gate.id)}
			on:dblclick={() => handleDoubleClick({ source: 'wire', gateId: gate.id })}
			on:contextmenu={(e) => onContextMenu(e, gate)}
			on:touchstart={longPress.onTouchStart}
			on:touchmove={longPress.onTouchMove}
			on:touchend={longPress.onTouchEnd}
			on:touchcancel={longPress.cancel}
			class={`gate z-10 cursor-grab select-none rounded-sm border border-ternary-1 active:text-white active:border-white shadow transition-colors duration-100 flex items-center justify-center ${
				gate.gate === 'swap'
					? `bg-transparent border-dashed border-ternary-1 text-ternary-1 active:bg-secondary-3 active:text-white font-extralight ${$isMobile ? 'h-9 w-8' : 'h-11 w-10'}`
					: gate.gate === 'x'
						? `bg-surface text-text active:bg-ternary-1 ${$isMobile ? 'px-1.5 py-1.5' : 'px-2 py-2'}`
						: isParametric(gate.gate)
							? // Tighter padding than a plain gate: the angle adds a second line,
								// and the column is only 58px wide (40px at its floor).
								`bg-surface text-text active:bg-ternary-1 ${$isMobile ? 'px-1.5 py-1' : 'px-2 py-1.5'}`
							: `bg-surface text-text active:bg-ternary-1 ${$isMobile ? 'px-2.5 py-1.5 text-sm' : 'px-3 py-2 text-base'}`
			}`}
			class:selected={$selectedGateIds.has(gate.id)}
			style="left: {(gate.column + 0.5) * columnWidth}px;"
		>
			{#if gate.gate === 'swap'}
				<span class={$isMobile ? 'text-[20px]' : 'text-[32px]'}>×</span>
			{:else if gate.gate === 'x'}
				<svg
					viewBox="0 0 28 28"
					width={$isMobile ? '16' : '20'}
					height={$isMobile ? '16' : '20'}
					aria-hidden="true"
				>
					<circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" stroke-width="2" />
					<line x1="2" y1="14" x2="26" y2="14" stroke="currentColor" stroke-width="2" />
					<line x1="14" y1="2" x2="14" y2="26" stroke="currentColor" stroke-width="2" />
				</svg>
			{:else if isParametric(gate.gate)}
				<span class="flex flex-col items-center leading-none">
					<span class={$isMobile ? 'text-xs' : 'text-sm'}>{gate.gate.toUpperCase()}</span>
					<span class="gate-angle">{angleOf(gate)}</span>
				</span>
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
			on:click={(e) =>
				$isMobile ? onMobileTap(gate.id, 'CONTROL', qubit) : handleGateSelection(gate.id, e)}
			on:keydown={(e) => onKeyDown(e, gate.id)}
			on:dblclick={() =>
				handleDoubleClick({ source: 'wire', gateId: gate.id, gateType: 'CONTROL', qubit })}
			class={`gate z-10 cursor-grab select-none rounded-sm ${$isMobile ? 'h-8 w-8' : 'h-11 w-10'} text-sm border border-ternary-1 bg-surface active:bg-ternary-1 active:border-white shadow transition-colors duration-100 flex items-center justify-center`}
			style="left: {(gate.column + 0.5) * columnWidth}px;"
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
			on:click={(e) =>
				$isMobile ? onMobileTap(gate.id, 'ANTI_CONTROL', qubit) : handleGateSelection(gate.id, e)}
			on:keydown={(e) => onKeyDown(e, gate.id)}
			on:dblclick={() =>
				handleDoubleClick({ source: 'wire', gateId: gate.id, gateType: 'ANTI_CONTROL', qubit })}
			class={`gate z-10 cursor-grab select-none rounded-sm ${$isMobile ? 'h-8 w-8' : 'h-11 w-10'} text-sm border border-ternary-1 bg-surface active:bg-ternary-1 active:border-white shadow transition-colors duration-100 flex items-center justify-center`}
			style="left: {(gate.column + 0.5) * columnWidth}px;"
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
				$isMobile ? onMobileTap(measureOp.id) : handleGateSelection(measureOp.id, e)}
			on:keydown={(e) => e.key === 'Delete' && removeGate(measureOp.id)}
			on:dblclick={() => handleDoubleClick({ source: 'wire', gateId: measureOp.id })}
			class="gate z-10 cursor-grab select-none rounded-sm px-3 py-2 text-base border bg-orange-100 text-orange-700 active:bg-orange-400 border-orange-300 active:text-white active:border-white shadow transition-colors duration-100"
			style="left: {(measureOp.column + 0.5) * columnWidth}px;"
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
		/* Suppress iOS's own long-press callout so ours is the only thing a hold does. */
		-webkit-touch-callout: none;
	}

	.gate.copying {
		box-shadow: 0 0 0 2px #3bc96f;
		outline: 2px solid #28ff33;
		outline-offset: -1px;
	}

	/* The angle under a parametric gate's letter. Deliberately small and dimmed:
	   it's secondary to the gate identity, and the column is only 58px wide. */
	.gate-angle {
		font-size: 0.5rem;
		margin-top: 1px;
		opacity: 0.75;
		font-variant-numeric: tabular-nums;
	}

	.gate.selected {
		box-shadow: 0 0 0 3px #3b82f6;
		outline: 2px solid #1e40af;
		outline-offset: -1px;
	}
</style>
