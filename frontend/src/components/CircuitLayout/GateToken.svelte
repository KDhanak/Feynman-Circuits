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
	import { PARAMETRIC_GATE_IDS, GATE_REGISTRY } from '$lib/quantum/gates';
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

	// The angle of an angle gate, shown on the token so you can read the circuit
	// without opening each gate's edit box. Shown as a fraction of π ("π/2"),
	// which is also how the edit box takes it. This is only for display. The real
	// value is stored in the operation's `params`.
	const isParametric = (g: string) => PARAMETRIC_GATE_IDS.includes(g as never);
	// Colour family for the tile (see .gate-tile / [data-family] in app.css).
	const familyOf = (g: string) =>
		(GATE_REGISTRY as Record<string, { category: string }>)[g]?.category ?? 'multi';
	const angleOf = (g: UnitaryOperation) => formatRadiansAsPi(g.params[0] ?? 0);

	// Hover/long-press text that explains what tapping to edit would change.
	function editableSummary(g: UnitaryOperation): string | undefined {
		if (isParametric(g.gate)) return `${g.gate.toUpperCase()} angle ${angleOf(g)}`;
		if (g.gate === 'swap') return `SWAP q${g.targets[0]} ↔ q${g.targets[1] ?? '?'}`;
		return undefined;
	}

	function onContextMenu(e: MouseEvent, gate: UnitaryOperation) {
		if (!editableGates.includes(gate.gate)) return;
		e.preventDefault();
		e.stopPropagation();
		// Android fires `contextmenu` in the middle of a long press. Block it and let
		// the long-press timer open the menu, so a touch opens the menu in only one way.
		if (longPress.isTouchActive()) return;
		dispatch('gatecontextmenu', { gate, x: e.clientX, y: e.clientY });
	}

	// Mobile: a tap adds or removes the gate from the selection (which controls the
	// delete button) and also picks it up for tap-to-move. These two don't clash,
	// because one needs a tap on the trash button and the other a tap on the board.
	// We only pick it up when the tapped gate is the only one selected, so selecting
	// many gates to delete still works: adding a second gate goes back to delete-only.
	function onMobileTap(gateId: string, gateType?: string, qubit?: number) {
		toggleGateSelection(gateId);
		const selected = get(selectedGateIds);
		if (selected.size === 1 && selected.has(gateId)) armGateForMove(gateId, gateType, qubit);
		else disarmGate();
	}

	// Touch screens have no right-click, so holding an editable gate opens the same edit box.
	$: editableOp = op.kind === 'unitary' && editableGates.includes(op.gate) ? op : null;

	const longPress = createLongPress({
		enabled: () => editableOp !== null,
		onLongPress: (target) => {
			if (!editableOp) return;
			// Place it under the gate instead of at the touch point, which is hidden
			// under the user's finger. This is the same place a newly dropped gate opens it.
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
			data-family={familyOf(gate.gate)}
			class={`gate gate-tile z-10 cursor-grab select-none rounded-md flex items-center justify-center ${
				gate.gate === 'swap'
					? `border-dashed font-extralight ${$isMobile ? 'h-9 w-8' : 'h-11 w-10'}`
					: gate.gate === 'x'
						? `${$isMobile ? 'px-1.5 py-1.5' : 'px-2 py-2'}`
						: isParametric(gate.gate)
							? // Tighter padding than a plain gate: the angle adds a second line,
								// and the column is only 58px wide (40px at its floor).
								`${$isMobile ? 'px-1.5 py-1' : 'px-2 py-1.5'}`
							: `${$isMobile ? 'px-2.5 py-1.5 text-sm' : 'px-3 py-2 text-base'}`
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
			data-family="control"
			class={`gate control-node z-10 cursor-grab select-none rounded-full ${$isMobile ? 'h-8 w-8' : 'h-10 w-10'} flex items-center justify-center`}
			style="left: {(gate.column + 0.5) * columnWidth}px;"
		>
			<div class="w-3.5 h-3.5 rounded-full bg-current"></div>
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
			data-family="control"
			class={`gate control-node z-10 cursor-grab select-none rounded-full ${$isMobile ? 'h-8 w-8' : 'h-10 w-10'} flex items-center justify-center`}
			style="left: {(gate.column + 0.5) * columnWidth}px;"
		>
			<div class="w-3.5 h-3.5 rounded-full border-2 border-current"></div>
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
			data-family="measure"
			class="gate gate-tile z-10 cursor-grab select-none rounded-md px-3 py-2 text-base"
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
		/* Turn off iOS's own long-press popup, so ours is the only thing a hold does. */
		-webkit-touch-callout: none;
	}

	.gate.copying {
		box-shadow: 0 0 0 2px #3bc96f;
		outline: 2px solid #28ff33;
		outline-offset: -1px;
	}

	/* The angle under an angle gate's letter. Small and dimmed on purpose:
	   it is less important than which gate it is, and the column is only 58px wide. */
	.gate-angle {
		font-size: 0.5rem;
		margin-top: 1px;
		opacity: 0.75;
		font-variant-numeric: tabular-nums;
	}

	.gate.selected {
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 35%, transparent);
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	/* Control dots: a bare dot on the wire, like a circuit diagram, rather than a
	   boxed button. The hit area stays the full 40px circle. */
	.control-node {
		color: var(--color-text);
		background: transparent;
	}
	.control-node:hover {
		background: color-mix(in srgb, var(--color-text) 8%, transparent);
	}
</style>
