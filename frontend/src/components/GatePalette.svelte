<script lang="ts">
	import type { CircuitIR, GateData } from '$lib/IR/schema';
	import {
		handlePaletteDrop,
		handleDoubleClick,
		handleTouchStart,
		handleTouchEnd,
		handleTouchMove,
		triggerSimulation
	} from '$lib/dragDropUtils';
	import { circuitIR } from '$lib/IR/stores';
	import { isDragging, showCircuitDataModal, circuitDataModalContent } from '$lib/uiStores';
import { showNotification } from '$lib/notificationUtils';
	import { importCircuit } from '$lib/IE';
	import { onMount } from 'svelte';
	import Icon from '@iconify/svelte';

	import CircuitDataModal from './CircuitDataModal.svelte';
	import { buildCanonicalString, type DataViewMode } from '$lib/circuitDataModal';

	export const gates: { type: string; name: string; category: string }[] = [
		{ type: 'X', name: 'X', category: 'single' },
		{ type: 'Y', name: 'Y', category: 'single' },
		{ type: 'Z', name: 'Z', category: 'single' },
		{ type: 'H', name: 'H', category: 'single' },
		{ type: 'S', name: 'S', category: 'single' },
		{ type: 'T', name: 'T', category: 'single' },
		{ type: 'CONTROL', name: 'CONTROL', category: 'multi' },
		{ type: 'ANTI_CONTROL', name: 'ANTI_CONTROL', category: 'multi' },
		{ type: 'MEASURE', name: 'MEASURE', category: 'single' }
	];

	let dropdownOpen = false;
	let activeView: DataViewMode = 'cir';
	let dragEnterCount = 0;

	function openCircuitDataModal() {
		activeView = 'cir';
		circuitDataModalContent.set(buildCanonicalString($circuitIR));
		showCircuitDataModal.set(true);
		dropdownOpen = false;
	}

	function closeModal() {
		showCircuitDataModal.set(false);
	}

	function handleTabChange(mode: DataViewMode) {
		activeView = mode;
		if (mode === 'cir') {
			circuitDataModalContent.set(buildCanonicalString($circuitIR));
		}
	}

	function importJson() {
		try {
			const input: unknown = JSON.parse($circuitDataModalContent);
			const result = importCircuit(input);

			// Type guard: check if it's an error response
			if ('detail' in result && !('version' in result)) {
				const errorMsg = result.detail ?? 'Unknown error';
				showNotification(errorMsg, 'error');
				return;
			}

			// Now TypeScript knows result is CircuitIR
			circuitIR.set(result as CircuitIR);
			triggerSimulation(result as CircuitIR);
			circuitDataModalContent.set(buildCanonicalString(result as CircuitIR));
			showNotification('Circuit imported successfully!', 'success');
		} catch {
			const errorMsg = 'Invalid JSON format';
			showNotification(errorMsg, 'error');
		}

		showCircuitDataModal.set(false);
	}

	function downloadFile(filename: string, content: string, mimeType = 'text/plain') {
		const blob = new Blob([content], { type: mimeType });
		const url = URL.createObjectURL(blob);

		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);

		URL.revokeObjectURL(url);
	}

	function exportCurrentView() {
		const content = buildCanonicalString($circuitIR);
		circuitDataModalContent.set(content);
		downloadFile('circuit.cir', content, 'text/plain');
		showNotification('Canonical IR downloaded!', 'success');
	}

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText($circuitDataModalContent);
			showNotification('Copied to clipboard!', 'success');
		} catch {
			showNotification('Failed to copy text. Please copy manually.', 'error');
		}
	}

	onMount(() => {
		const handleClick = (event: MouseEvent) => {
			if (event.target && !(event.target as HTMLElement).closest('.dropdown-container')) {
				dropdownOpen = false;
			}
		};

		document.addEventListener('click', handleClick);
		return () => document.removeEventListener('click', handleClick);
	});
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
		{#if gate.category === 'multi' && gate.type === 'CONTROL'}
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
</div>

<CircuitDataModal
	open={$showCircuitDataModal}
	{activeView}
	bind:value={$circuitDataModalContent}
	onClose={closeModal}
	onTabChange={handleTabChange}
	onCopy={copyToClipboard}
	onDownload={exportCurrentView}
	onImport={importJson}
/>

<style>
</style>
