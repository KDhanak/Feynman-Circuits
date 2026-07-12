<script lang="ts">
	import type { GateData } from '$lib/IR/schema';
	import {
		handlePaletteDrop,
		handleDoubleClick
	} from '$lib/circuit/dragDropUtils';
	import { isDragging, armedGate } from '$lib/stores/uiStores';
	import { showNotification } from '$lib/utils/notificationUtils';
	import { manualSave } from '$lib/circuit/autoSave';
	import { currentCircuitName } from '$lib/IR/stores';
	import Icon from '@iconify/svelte';
	import { session } from '$lib/auth/session';
	import { get } from 'svelte/store';
	import { applyBellPairPreset, compactCircuit } from '$lib/circuit/circuitActions';
	import Tooltip from './Tooltip.svelte';
	import {isMobile} from '$lib/stores/isMobile';

	const gates: { type: string; name: string; category: string; quick: string; detail: string }[] = [
		{
			type: 'X',
			name: 'X',
			category: 'single',
			quick: 'Pauli-X (NOT)',
			detail: 'Flips |0⟩ to |1⟩ and vice versa. The quantum equivalent of a classical NOT gate.'
		},
		{
			type: 'Y',
			name: 'Y',
			category: 'single',
			quick: 'Pauli-Y',
			detail:
				'Flips the qubit and adds a phase of i. Rotates 180° around the Y-axis of the Bloch sphere.'
		},
		{
			type: 'Z',
			name: 'Z',
			category: 'single',
			quick: 'Pauli-Z',
			detail: 'Leaves |0⟩ unchanged, flips the phase of |1⟩. Rotates 180° around the Z-axis.'
		},
		{
			type: 'H',
			name: 'H',
			category: 'single',
			quick: 'Hadamard',
			detail:
				'Puts a qubit into equal superposition — a measurement gives |0⟩ or |1⟩ with 50/50 probability.'
		},
		{
			type: 'S',
			name: 'S',
			category: 'single',
			quick: 'S Gate (Phase)',
			detail: 'Adds a 90° phase shift to |1⟩. Equivalent to √Z.'
		},
		{
			type: 'T',
			name: 'T',
			category: 'single',
			quick: 'T Gate',
			detail: 'Adds a 45° phase shift to |1⟩. Used heavily in fault-tolerant quantum computing.'
		},
		{
			type: 'RX',
			name: 'RX',
			category: 'parametric',
			quick: 'X-Rotation',
			detail:
				'Rotates the qubit around the X-axis by a chosen angle θ. Double-click to set the angle.'
		},
		{
			type: 'RY',
			name: 'RY',
			category: 'parametric',
			quick: 'Y-Rotation',
			detail:
				'Rotates the qubit around the Y-axis by a chosen angle θ. Double-click to set the angle.'
		},
		{
			type: 'RZ',
			name: 'RZ',
			category: 'parametric',
			quick: 'Z-Rotation',
			detail:
				'Rotates the qubit around the Z-axis by a chosen angle θ. Double-click to set the angle.'
		},
		{
			type: 'CONTROL',
			name: 'CONTROL',
			category: 'multi',
			quick: 'Control',
			detail:
				'Makes the next gate conditional — it only fires if this qubit is |1⟩. Drop it on the same column as a gate.'
		},
		{
			type: 'ANTI_CONTROL',
			name: 'ANTI_CONTROL',
			category: 'multi',
			quick: 'Anti-Control',
			detail: 'Like Control, but fires when the qubit is |0⟩ instead of |1⟩.'
		},
		{
			type: 'SWAP',
			name: 'SWAP',
			category: 'two-qubit',
			quick: 'SWAP',
			detail: 'Exchanges the states of two qubits. Drop both ends on the same column.'
		},
		{
			type: 'MEASURE',
			name: 'MEASURE',
			category: 'single',
			quick: 'Measure',
			detail:
				"Collapses the qubit to a definite |0⟩ or |1⟩ using Born's rule. The outcome is random, weighted by probability. (In reality, its pseudo-random for a web simulator)"
		}
	];

	let dragEnterCount = 0;

	// Mobile tap-to-place: tapping a gate arms it (tapping the armed gate disarms).
	function toggleArm(gateType: string) {
		armedGate.update((cur) =>
			cur?.gateType === gateType ? null : { source: 'palette', gateType }
		);
	}

	async function saveCircuit() {
		if (get(session).status !== 'authenticated') {
			showNotification('Please sign in to save your circuit.', 'error');
			return;
		}
		const newName = prompt('Enter a name for your circuit:', $currentCircuitName);
		if (newName === null) return;
		if (newName.trim() === '') {
			showNotification('Circuit name cannot be empty.', 'error');
			return;
		}

		const previousName = $currentCircuitName;
		currentCircuitName.set(newName.trim());
		try {
			await manualSave();
			showNotification('Circuit saved!', 'success');
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
	class="relative mb-4 max-w-420 mx-auto w-[96%] h-auto py-4 flex flex-wrap justify-center gap-3 rounded-sm shadow-sm shadow-secondary-2 bg-secondary-3/20"
>
	{#each gates as gate}
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
				on:dblclick={() => !$isMobile && handleDoubleClick({ source: 'palette', gateType: gate.type })}
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
						<Icon icon="si:meter-fill" width={$isMobile ? '16' : '20'} height={$isMobile ? '16' : '20'} />
					</span>
				{:else if gate.type === 'X'}
					<svg viewBox="0 0 28 28" width={$isMobile ? '16' : '20'} height={$isMobile ? '16' : '20'} aria-hidden="true">
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
		on:click={saveCircuit}>Save Circuit</button
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

<style>
</style>
