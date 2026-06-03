<script lang="ts">
	import type { GateData } from '$lib/IR/schema';
	import {
		handlePaletteDrop,
		handleDoubleClick,
		handleTouchStart,
		handleTouchEnd,
		handleTouchMove,
	} from '$lib/circuit/dragDropUtils';
	import { circuitIR } from '$lib/IR/stores';
	import { isDragging, showCircuitDataModal, circuitDataModalContent } from '$lib/stores/uiStores';
	import { showNotification } from '$lib/utils/notificationUtils';
	import { manualSave } from '$lib/circuit/autoSave';
	import { currentCircuitName } from '$lib/IR/stores';
	import Icon from '@iconify/svelte';
	import CircuitDataModal from './CircuitDataModal.svelte';
	import { buildCanonicalString, type DataViewMode } from '$lib/circuit/circuitDataModal';
	import {session} from '$lib/auth/session';
	import { get } from 'svelte/store';
	import { importJson, copyToClipboard, downloadCircuit } from '$lib/circuit/circuitActions';

	export const gates: { type: string; name: string; category: string }[] = [
		{ type: 'X', name: 'X', category: 'single' },
		{ type: 'Y', name: 'Y', category: 'single' },
		{ type: 'Z', name: 'Z', category: 'single' },
		{ type: 'H', name: 'H', category: 'single' },
		{ type: 'S', name: 'S', category: 'single' },
		{ type: 'T', name: 'T', category: 'single' },
		{ type: 'RX', name: 'RX', category: 'parametric' },
		{ type: 'RY', name: 'RY', category: 'parametric' },
		{ type: 'RZ', name: 'RZ', category: 'parametric' },
		{ type: 'CONTROL', name: 'CONTROL', category: 'multi' },
		{ type: 'ANTI_CONTROL', name: 'ANTI_CONTROL', category: 'multi' },
		{ type: 'MEASURE', name: 'MEASURE', category: 'single' }
	];

	let activeView: DataViewMode = 'cir';
	let dragEnterCount = 0;

	function closeModal() {
		showCircuitDataModal.set(false);
	}

	function handleTabChange(mode: DataViewMode) {
		activeView = mode;
		if (mode === 'cir') {
			circuitDataModalContent.set(buildCanonicalString($circuitIR));
		} else if (mode === 'qasm') {
			// Placeholder for QASM generation
			circuitDataModalContent.set('QASM view coming soon...');
		}
	}

	async function saveCircuit() {
		if (get(session).status !== 'authenticated') {
			showNotification('Please sign in to save your circuit.', 'error');
			return;
		}
		const newName = prompt('Enter a name for your circuit:', $currentCircuitName);
		if (newName === null) return;

		currentCircuitName.set(newName);
		await manualSave();
		showNotification('Circuit saved!', 'success');
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
	class="relative mb-4 w-[96%] h-auto py-4 flex flex-wrap justify-center gap-3 rounded-sm shadow-sm shadow-secondary-2 bg-secondary-3/20"
>
	{#each gates as gate}
		<!-- Separator before multi-qubit gates -->
		{#if (gate.category === 'multi' || gate.category === 'two-qubit') && (gate.type === 'CONTROL' || gate.type === 'RZZ')}
			<div class="w-px h-8 bg-secondary-3 self-center mx-1"></div>
		{/if}
		{#if gate.category === 'parametric' && gate.type === 'RX'}
			<div class="w-px h-8 bg-secondary-3 self-center mx-1"></div>
		{/if}
		<div
			title={gate.name}
			role="region"
			draggable="true"
			on:dragstart={(e) => {
				const dragData: GateData = { source: 'palette', gateType: gate.type };
				e.dataTransfer?.setData('application/json', JSON.stringify(dragData));
				isDragging.set(true);
			}}
			on:dragend={() => isDragging.set(false)}
			on:dblclick={() => handleDoubleClick({ source: 'palette', gateType: gate.type })}
			on:touchstart={(e) => handleTouchStart(e, { source: 'palette', gateType: gate.type })}
			on:touchmove={handleTouchMove}
			on:touchend={(e) => handleTouchEnd(e)}
			class={`cursor-grab select-none border bg-white hover:bg-secondary-1 hover:border-secondary-3 active:bg-secondary-3 active:text-white active:border-white flex items-center justify-center transition-colors duration-100 ${
				['CONTROL', 'ANTI_CONTROL', 'MEASURE'].includes(gate.type)
					? 'h-11 w-10 rounded-sm border-secondary-4'
					: ['RX', 'RY', 'RZ'].includes(gate.type)
						? 'h-11 w-11 rounded-sm border-secondary-4 text-sm font-medium text-secondary-2'
						: 'rounded-sm border-secondary-4 px-3.5 py-2 text-base font-medium text-secondary-2'
			}`}
		>
			{#if gate.type === 'CONTROL'}
				<span class="h-3 w-3 rounded-full bg-secondary-4"></span>
			{:else if gate.type === 'ANTI_CONTROL'}
				<span class="h-3 w-3 rounded-full border border-secondary-4"></span>
			{:else if gate.type === 'MEASURE'}
				<span class="text-secondary-4">
					<Icon icon="si:meter-fill" width="20" height="20" />
				</span>
			{:else}
				{gate.name}
			{/if}
		</div>
	{/each}
	<button class="btn-secondary" on:click={saveCircuit}>Save Circuit</button>
</div>

<CircuitDataModal
	open={$showCircuitDataModal}
	{activeView}
	bind:value={$circuitDataModalContent}
	onClose={closeModal}
	onTabChange={handleTabChange}
	onCopy={() => copyToClipboard($circuitDataModalContent)}
	onDownload={() => downloadCircuit($currentCircuitName, $circuitIR)}
	onImport={() => importJson($circuitDataModalContent)}
/>

<style>
</style>
