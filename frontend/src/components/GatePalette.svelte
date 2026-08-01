<script lang="ts">
	import type { GateData } from '$lib/IR/schema';
	import { handlePaletteDrop, handleDoubleClick } from '$lib/circuit/dragDropUtils';
	import { isDragging, armedGate } from '$lib/stores/uiStores';
	import { showNotification } from '$lib/utils/notificationUtils';
	import { manualSave, isCircuitSaved } from '$lib/circuit/autoSave';
	import { currentCircuitName } from '$lib/IR/stores';
	import NameDialog from './NameDialog.svelte';
	import Icon from '@iconify/svelte';
	import { session } from '$lib/auth/session';
	import { get } from 'svelte/store';
	import { applyBellPairPreset, compactCircuit } from '$lib/circuit/circuitActions';
	import Tooltip from './Tooltip.svelte';
	import { isMobile } from '$lib/stores/isMobile';
	import { GATE_REGISTRY, UNITARY_GATE_IDS, paletteCategory } from '$lib/quantum/gates';

	type PaletteTile = {
		type: string;
		name: string;
		category: string;
		quick: string;
		detail: string;
	};

	// Editor primitives — not gates, so they don't live in the registry.
	const CONTROL_TILE: PaletteTile = {
		type: 'CONTROL',
		name: 'CONTROL',
		category: 'multi',
		quick: 'Control',
		detail:
			'Makes the next gate conditional — it only fires if this qubit is |1⟩. Drop it on the same column as a gate.'
	};
	const ANTI_CONTROL_TILE: PaletteTile = {
		type: 'ANTI_CONTROL',
		name: 'ANTI_CONTROL',
		category: 'multi',
		quick: 'Anti-Control',
		detail: 'Like Control, but fires when the qubit is |0⟩ instead of |1⟩.'
	};
	const MEASURE_TILE: PaletteTile = {
		type: 'MEASURE',
		name: 'MEASURE',
		category: 'single',
		quick: 'Measure',
		detail:
			"Collapses the qubit to a definite |0⟩ or |1⟩ using Born's rule. The outcome is random, weighted by probability. (In reality, its pseudo-random for a web simulator)"
	};

	// Gate tiles are derived from the registry so a new gate shows up here
	// automatically. Palette drag/drop uses uppercase type strings.
	const toTile = (id: (typeof UNITARY_GATE_IDS)[number]): PaletteTile => {
		const spec = GATE_REGISTRY[id];
		return {
			type: id.toUpperCase(),
			name: spec.label,
			category: paletteCategory(spec),
			quick: spec.tooltip.quick,
			detail: spec.tooltip.detail
		};
	};
	const singleAndParametric = UNITARY_GATE_IDS.filter((id) => GATE_REGISTRY[id].arity === 1).map(
		toTile
	);
	const twoQubit = UNITARY_GATE_IDS.filter((id) => GATE_REGISTRY[id].arity >= 2).map(toTile);

	// Order preserved from the original hand-written list: single/parametric gates,
	// then the control primitives, then two-qubit gates, then measure.
	const gates: PaletteTile[] = [
		...singleAndParametric,
		CONTROL_TILE,
		ANTI_CONTROL_TILE,
		...twoQubit,
		MEASURE_TILE
	];

	let dragEnterCount = 0;

	// Mobile tap-to-place: tapping a gate arms it (tapping the armed gate disarms).
	function toggleArm(gateType: string) {
		armedGate.update((cur) =>
			cur?.gateType === gateType ? null : { source: 'palette', gateType }
		);
	}

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
	class="relative mb-2.5 max-w-420 mx-auto w-[96%] h-auto py-4 flex flex-wrap justify-center gap-3 rounded-sm shadow-sm shadow-secondary-2 bg-secondary-3/20"
>
	{#each gates as gate (gate.name)}
		<!-- Separator before multi-qubit gates -->
		{#if (gate.category === 'multi' || gate.category === 'two-qubit') && (gate.type === 'CONTROL' || gate.type === 'RZZ' || gate.type === 'SWAP')}
			<div class="w-px h-8 bg-secondary-3 self-center mx-1"></div>
		{/if}
		{#if gate.category === 'parametric' && gate.type === 'RX'}
			<div class="w-px h-8 bg-secondary-3 self-center mx-1"></div>
		{/if}
		<Tooltip quick={gate.quick} detail={gate.detail}>
			<div
				title={gate.name}
				role="button"
				tabindex="0"
				draggable="true"
				on:keydown={(e) => {
					if ($isMobile && (e.key === 'Enter' || e.key === ' ')) {
						e.preventDefault();
						toggleArm(gate.type);
					}
				}}
				on:dragstart={(e) => {
					const dragData: GateData = { source: 'palette', gateType: gate.type };
					e.dataTransfer?.setData('application/json', JSON.stringify(dragData));
					isDragging.set(true);
				}}
				on:dragend={() => isDragging.set(false)}
				on:dblclick={() =>
					!$isMobile && handleDoubleClick({ source: 'palette', gateType: gate.type })}
				on:click={() => $isMobile && toggleArm(gate.type)}
				class={`cursor-grab select-none ${$isMobile ? 'h-9 w-9' : 'h-11 w-11'} rounded-sm border text-text bg-surface active:bg-ternary-1 active:text-white active:border-white flex items-center justify-center transition-colors duration-100 ${
					$armedGate?.gateType === gate.type
						? 'border-measured ring-2 ring-measured'
						: 'border-ternary-1'
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
		on:click={openNameDialog}>{$isCircuitSaved ? 'Rename Circuit' : 'Save Circuit'}</button
	>
	<button
		class="border rounded-sm bg-surface px-3 py-1 text-sm cursor-pointer text-text border-ternary-1 active:bg-ternary-1 active:text-white active:border-white shadow transition-colors duration-100 flex items-center justify-center"
		on:click={applyBellPairPreset}>Bell Pair</button
	>
	<button
		class="border rounded-sm bg-surface px-3 py-1 text-sm cursor-pointer text-text border-ternary-1 active:bg-ternary-1 active:text-white active:border-white shadow transition-colors duration-100 flex items-center justify-center"
		on:click={compactCircuit}>Compact</button
	>
</div>

<NameDialog
	open={showNameDialog}
	title={$isCircuitSaved ? 'Rename Circuit' : 'Save Circuit'}
	value={$currentCircuitName}
	confirmLabel="Save"
	onConfirm={saveCircuit}
	onCancel={() => (showNameDialog = false)}
/>

<style>
</style>
