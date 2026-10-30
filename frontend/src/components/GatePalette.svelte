<script lang="ts">
	import type { GateData } from '$lib/IR/schema';
	import { handlePaletteDrop, handleDoubleClick } from '$lib/circuit/dragDropUtils';
	import { isDragging, armedGate } from '$lib/stores/uiStores';
	import { clearSelection } from '$lib/circuit/selection';
	import Icon from '@iconify/svelte';
	import { applyBellPairPreset, compactCircuit, toggleQecMode } from '$lib/circuit/circuitActions';
	import Tooltip from './Tooltip.svelte';
	import { isMobile } from '$lib/stores/isMobile';
	import {
		GATE_REGISTRY,
		UNITARY_GATE_IDS,
		paletteCategory,
		type TooltipMatrix
	} from '$lib/quantum/gates';
	import { qecMode, qubitLimit } from '$lib/qec/stores';

	type PaletteTile = {
		type: string;
		name: string;
		category: string;
		quick: string;
		detail: string;
		matrix?: TooltipMatrix; // left out for Control, Anti-Control and Measure, which are not gates
		// Can be used while QEC mode is on. Non-Clifford gates are blocked there
		// because Stim, which runs QEC, cannot simulate them at all.
		clifford: boolean;
		// Acts on one qubit. QEC mode has only one (the logical qubit), so
		// anything that needs a second qubit is blocked there too.
		singleQubit: boolean;
		// Colour family (see .gate-tile / [data-family] in app.css).
		family: string;
	};

	// Why a tile cannot be used in QEC mode, or null if it can.
	function blockReason(gate: PaletteTile): string | null {
		if (!gate.clifford)
			return `${gate.name} is not a Clifford gate, and the stabiliser simulator behind the QEC path cannot represent it.`;
		if (!gate.singleQubit)
			return `${gate.quick} needs two qubits, and QEC mode works on one logical qubit.`;
		return null;
	}

	// Basic editor items. They are not gates, so they are not in the registry.
	const CONTROL_TILE: PaletteTile = {
		type: 'CONTROL',
		name: 'CONTROL',
		category: 'multi',
		clifford: true,
		singleQubit: false,
		family: 'control',
		quick: 'Control',
		detail:
			'Makes the next gate conditional — it only fires if this qubit is |1⟩. Drop it on the same column as a gate.'
	};
	const ANTI_CONTROL_TILE: PaletteTile = {
		type: 'ANTI_CONTROL',
		name: 'ANTI_CONTROL',
		category: 'multi',
		clifford: true,
		singleQubit: false,
		family: 'control',
		quick: 'Anti-Control',
		detail: 'Like Control, but fires when the qubit is |0⟩ instead of |1⟩.'
	};
	const MEASURE_TILE: PaletteTile = {
		type: 'MEASURE',
		name: 'MEASURE',
		category: 'single',
		clifford: true,
		singleQubit: true,
		family: 'measure',
		quick: 'Measure',
		detail:
			"Collapses the qubit to a definite |0⟩ or |1⟩ using Born's rule. The outcome is random, weighted by probability. (In reality, its pseudo-random for a web simulator)"
	};

	// Gate tiles are built from the registry, so a new gate shows up here
	// automatically. Palette drag/drop uses uppercase type strings.
	const toTile = (id: (typeof UNITARY_GATE_IDS)[number]): PaletteTile => {
		const spec = GATE_REGISTRY[id];
		return {
			type: id.toUpperCase(),
			name: spec.label,
			category: paletteCategory(spec),
			clifford: spec.clifford,
			singleQubit: spec.arity === 1,
			family: spec.category,
			quick: spec.tooltip.quick,
			detail: spec.tooltip.detail,
			matrix: spec.tooltip.matrix
		};
	};
	const singleAndParametric = UNITARY_GATE_IDS.filter((id) => GATE_REGISTRY[id].arity === 1).map(
		toTile
	);
	const twoQubit = UNITARY_GATE_IDS.filter((id) => GATE_REGISTRY[id].arity >= 2).map(toTile);

	// Same order as the original hand-written list: single/angle gates,
	// then the control primitives, then two-qubit gates, then measure.
	const gates: PaletteTile[] = [
		...singleAndParametric,
		CONTROL_TILE,
		ANTI_CONTROL_TILE,
		...twoQubit,
		MEASURE_TILE
	];

	let dragEnterCount = 0;

	// Mobile tap-to-place: tapping a gate selects it (tapping it again unselects it).
	// This clears any selection on the board. Otherwise a board gate would still be
	// shown as picked up, while the palette gate is the one really selected.
	function toggleArm(gateType: string) {
		clearSelection();
		armedGate.update((cur) =>
			cur?.source === 'palette' && cur.gateType === gateType
				? null
				: { source: 'palette', gateType }
		);
	}
</script>

<div
	aria-label="Quantum Circuit Gate Palette"
	role="region"
	on:drop={(e) => {
		handlePaletteDrop(e);
		dragEnterCount = 0;
		e.currentTarget.classList.remove('drop-target-active');
	}}
	on:dragover={(e) => e.preventDefault()}
	on:dragenter={(e) => {
		dragEnterCount++;
		e.currentTarget.classList.add('drop-target-active');
	}}
	on:dragleave={(e) => {
		dragEnterCount--;
		if (dragEnterCount === 0) e.currentTarget.classList.remove('drop-target-active');
	}}
	class="panel relative mb-2 max-w-420 mx-auto w-[96%] h-auto py-3 px-3 flex flex-wrap justify-center items-center gap-2.5"
	data-tour="palette"
>
	{#each gates as gate (gate.name)}
		<!-- Blocked, not hidden: a greyed-out tile shows that the gate is not available
		     right now, while a missing one would just look broken. -->
		{@const reason = $qecMode ? blockReason(gate) : null}
		{@const blocked = reason !== null}
		<!-- Separator before multi-qubit gates -->
		{#if (gate.category === 'multi' || gate.category === 'two-qubit') && (gate.type === 'CONTROL' || gate.type === 'RZZ' || gate.type === 'SWAP')}
			<div class="w-px h-7 self-center mx-1" style="background: var(--color-border-strong)"></div>
		{/if}
		{#if gate.category === 'parametric' && gate.type === 'RX'}
			<div class="w-px h-7 self-center mx-1" style="background: var(--color-border-strong)"></div>
		{/if}
		<Tooltip
			quick={gate.quick}
			matrix={gate.matrix}
			subtle
			detail={blocked
				? `${gate.detail}

Unavailable in QEC mode: ${reason}`
				: gate.detail}
		>
			<div
				title={blocked ? `${gate.quick}: not available in QEC mode` : gate.name}
				role="button"
				aria-disabled={blocked}
				tabindex={blocked ? -1 : 0}
				draggable={!blocked}
				on:keydown={(e) => {
					if (blocked) return;
					if ($isMobile && (e.key === 'Enter' || e.key === ' ')) {
						e.preventDefault();
						toggleArm(gate.type);
					}
				}}
				on:dragstart={(e) => {
					if (blocked) {
						e.preventDefault();
						return;
					}
					const dragData: GateData = { source: 'palette', gateType: gate.type };
					e.dataTransfer?.setData('application/json', JSON.stringify(dragData));
					isDragging.set(true);
				}}
				on:dragend={() => isDragging.set(false)}
				on:dblclick={() =>
					!blocked && !$isMobile && handleDoubleClick({ source: 'palette', gateType: gate.type })}
				on:click={() => !blocked && $isMobile && toggleArm(gate.type)}
				data-family={gate.family}
				class={`gate-tile select-none ${$isMobile ? 'h-9 w-9' : 'h-11 w-11'} rounded-md flex items-center justify-center transition-colors duration-100 ${
					blocked
						? 'cursor-not-allowed opacity-30 line-through'
						: `cursor-grab ${
								$armedGate?.gateType === gate.type ? 'ring-2 ring-offset-1 ring-measured' : ''
							}`
				}`}
			>
				{#if gate.type === 'CONTROL'}
					<span class="h-3 w-3 rounded-full bg-current"></span>
				{:else if gate.type === 'ANTI_CONTROL'}
					<span class="h-3 w-3 rounded-full border-2 border-current"></span>
				{:else if gate.type === 'MEASURE'}
					<span>
						<Icon
							icon="si:meter-fill"
							width={$isMobile ? '16' : '20'}
							height={$isMobile ? '16' : '20'}
						/>
					</span>
				{:else if gate.type === 'X'}
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
				{:else}
					<span
						class={gate.name.length > 2 ? 'text-[10px] leading-none tracking-wide' : 'text-[15px]'}
						>{gate.name}</span
					>
				{/if}
			</div>
		</Tooltip>
	{/each}
	<button
		class="btn-quiet h-9"
		disabled={$qubitLimit < 2}
		title={$qubitLimit < 2 ? 'Bell Pair needs two qubits: not available in QEC mode' : 'Bell Pair'}
		on:click={applyBellPairPreset}>Bell Pair</button
	>
	<button class="btn-quiet h-9" on:click={compactCircuit}>Compact</button>

	<!--
		The QEC mode button is next to the palette instead of in the header: it
		changes what this bar offers, so it belongs beside the thing it changes. The
		line before it shows it is a different kind of button. Bell Pair and Compact
		do something once, while this is a mode that stays on.
	-->
	<span class="w-px h-7 self-center mx-1" style="background: var(--color-border-strong)"></span>
	<button
		on:click={toggleQecMode}
		aria-pressed={$qecMode}
		title={$qecMode
			? 'QEC mode is on — only Clifford gates are available'
			: 'QEC mode — restricts the palette to Clifford gates'}
		class="btn-quiet h-9 {$qecMode ? 'qec-on' : ''}"
	>
		<Icon icon="ph:shield-check-bold" width="15" height="15" />
		QEC
	</button>
</div>

<style>
	/* QEC toggle when on: solid emerald, so the mode switch reads as "on". */
	:global(.btn-quiet.qec-on) {
		background: var(--color-qec-1);
		border-color: var(--color-qec-1);
		color: var(--color-qec-fg);
	}
</style>
