<script lang="ts">
	import type { GateData } from '$lib/IR/schema';
	import { handlePaletteDrop, handleDoubleClick } from '$lib/circuit/dragDropUtils';
	import { isDragging, armedGate } from '$lib/stores/uiStores';
	import { clearSelection } from '$lib/circuit/selection';
	import Icon from '@iconify/svelte';
	import { applyBellPairPreset, compactCircuit, toggleQecMode } from '$lib/circuit/circuitActions';
	import Tooltip from './Tooltip.svelte';
	import { isMobile } from '$lib/stores/isMobile';
	import { GATE_REGISTRY, UNITARY_GATE_IDS, paletteCategory } from '$lib/quantum/gates';
	import { qecMode } from '$lib/qec/stores';

	type PaletteTile = {
		type: string;
		name: string;
		category: string;
		quick: string;
		detail: string;
		// Can be used while QEC mode is on. Non-Clifford gates are blocked there
		// because Stim, which runs QEC, cannot simulate them at all.
		clifford: boolean;
	};

	// Basic editor items. They are not gates, so they are not in the registry.
	const CONTROL_TILE: PaletteTile = {
		type: 'CONTROL',
		name: 'CONTROL',
		category: 'multi',
		clifford: true,
		quick: 'Control',
		detail:
			'Makes the next gate conditional — it only fires if this qubit is |1⟩. Drop it on the same column as a gate.'
	};
	const ANTI_CONTROL_TILE: PaletteTile = {
		type: 'ANTI_CONTROL',
		name: 'ANTI_CONTROL',
		category: 'multi',
		clifford: true,
		quick: 'Anti-Control',
		detail: 'Like Control, but fires when the qubit is |0⟩ instead of |1⟩.'
	};
	const MEASURE_TILE: PaletteTile = {
		type: 'MEASURE',
		name: 'MEASURE',
		category: 'single',
		clifford: true,
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
			quick: spec.tooltip.quick,
			detail: spec.tooltip.detail
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
	class="relative mb-2 max-w-420 mx-auto w-[96%] h-auto py-4 flex flex-wrap justify-center gap-3 rounded-sm shadow-sm shadow-secondary-2 bg-secondary-3/20"
	data-tour="palette"
>
	{#each gates as gate (gate.name)}
		<!-- Blocked, not hidden: a greyed-out tile shows that the gate is not available
		     right now, while a missing one would just look broken. -->
		{@const blocked = $qecMode && !gate.clifford}
		<!-- Separator before multi-qubit gates -->
		{#if (gate.category === 'multi' || gate.category === 'two-qubit') && (gate.type === 'CONTROL' || gate.type === 'RZZ' || gate.type === 'SWAP')}
			<div class="w-px h-8 bg-secondary-3 self-center mx-1"></div>
		{/if}
		{#if gate.category === 'parametric' && gate.type === 'RX'}
			<div class="w-px h-8 bg-secondary-3 self-center mx-1"></div>
		{/if}
		<Tooltip
			quick={gate.quick}
			detail={blocked
				? `${gate.detail}

Unavailable in QEC mode: ${gate.name} is not a Clifford gate, and the stabiliser simulator behind the QEC path cannot represent it.`
				: gate.detail}
		>
			<div
				title={blocked ? `${gate.name} — not available in QEC mode (non-Clifford)` : gate.name}
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
				class={`select-none ${$isMobile ? 'h-9 w-9' : 'h-11 w-11'} rounded-sm border text-text bg-surface flex items-center justify-center transition-colors duration-100 ${
					blocked
						? 'cursor-not-allowed opacity-35 border-ternary-1 line-through'
						: `cursor-grab active:bg-ternary-1 active:text-white active:border-white ${
								$armedGate?.gateType === gate.type
									? 'border-measured ring-2 ring-measured'
									: 'border-ternary-1'
							}`
				}`}
			>
				{#if gate.type === 'CONTROL'}
					<span class="h-3 w-3 rounded-full bg-text"></span>
				{:else if gate.type === 'ANTI_CONTROL'}
					<span class="h-3 w-3 rounded-full border border-text"></span>
				{:else if gate.type === 'MEASURE'}
					<span class="text-text">
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
					<span class={gate.name.length > 2 ? 'text-[10px] leading-none' : ''}>{gate.name}</span>
				{/if}
			</div>
		</Tooltip>
	{/each}
	<button
		class="border rounded-sm bg-surface px-3 py-1 text-sm cursor-pointer text-text border-ternary-1 active:bg-ternary-1 active:text-white active:border-white shadow transition-colors duration-100 flex items-center justify-center"
		on:click={applyBellPairPreset}>Bell Pair</button
	>
	<button
		class="border rounded-sm bg-surface px-3 py-1 text-sm cursor-pointer text-text border-ternary-1 active:bg-ternary-1 active:text-white active:border-white shadow transition-colors duration-100 flex items-center justify-center"
		on:click={compactCircuit}>Compact</button
	>

	<!--
		The QEC mode button is next to the palette instead of in the header: it
		changes what this bar offers, so it belongs beside the thing it changes. The
		line before it shows it is a different kind of button. Bell Pair and Compact
		do something once, while this is a mode that stays on.
	-->
	<span class="w-px self-stretch" style="background: var(--color-border)"></span>
	<button
		on:click={toggleQecMode}
		aria-pressed={$qecMode}
		title={$qecMode
			? 'QEC mode is on — only Clifford gates are available'
			: 'QEC mode — restricts the palette to Clifford gates'}
		class="flex cursor-pointer items-center gap-1.5 rounded-sm border px-3 py-1 text-sm transition-colors duration-100 {$qecMode
			? 'bg-qec-1 border-qec-1 text-qec-fg shadow-sm shadow-qec-1'
			: 'bg-surface text-text border-ternary-1 shadow'}"
	>
		<Icon icon="ph:shield-check-bold" width="15" height="15" />
		QEC
	</button>
</div>

<style>
</style>
