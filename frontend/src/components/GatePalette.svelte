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
	import { isDragging } from '$lib/stores';
	import { resetCircuit } from '$lib/simulator';
	import { importCircuit } from '$lib/IE';
	import { onMount } from 'svelte';
	import Icon from '@iconify/svelte';

	import CircuitDataModal from './CircuitDataModal.svelte';
	import { buildCanonicalString, type DataViewMode } from '$lib/circuitDataModal';
	import { validateCanonicalIR } from '$lib/IR/validate';
	import { circuitIR } from '$lib/IR/stores';

	export const gates: { type: string; name: string; category: string }[] = [
		{ type: 'X', name: 'X', category: 'single' },
		{ type: 'Y', name: 'Y', category: 'single' },
		{ type: 'Z', name: 'Z', category: 'single' },
		{ type: 'H', name: 'H', category: 'single' },
		{ type: 'S', name: 'S', category: 'single' },
		{ type: 'T', name: 'T', category: 'single' },
		{ type: 'CONTROL', name: 'CONTROL', category: 'multi' },
		{ type: 'MEASURE', name: 'MEASURE', category: 'single' }
	];

	let dropdownOpen = false;
	let isEnlarged = false;
	let activeView: DataViewMode = 'cir';
	let editorContent = '';
	let message = '';
	let errorMessage = '';
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let shake = false;
	let dragEnterCount = 0;

	// Hide CONTROL gate when there's only 1 qubit (clean beginner experience)
	$: isSingleQubit = $circuitIR.registers.q === 1;

	function flash(opts: { text: string; isError?: boolean; duration?: number }) {
		const { text, isError = false, duration = 2000 } = opts;

		if (timeoutId) clearTimeout(timeoutId);

		message = '';
		errorMessage = '';

		if (isError) {
			errorMessage = text;
			shake = false;
			requestAnimationFrame(() => (shake = true));
		} else {
			message = text;
			shake = false;
		}

		timeoutId = setTimeout(() => {
			message = '';
			errorMessage = '';
		}, duration);
	}

	function openCircuitDataModal() {
		activeView = 'cir';
		editorContent = buildCanonicalString($circuitIR);
		isEnlarged = true;
		dropdownOpen = false;
	}

	function closeModal() {
		isEnlarged = false;
	}

	function handleTabChange(mode: DataViewMode) {
		activeView = mode;
		if (mode === 'cir') {
			editorContent = buildCanonicalString($circuitIR);
		}
	}

	function importJson() {
		try {
			const input: unknown = JSON.parse(editorContent);
			const result = importCircuit(input);

			// Type guard: check if it's an error response
			if ('detail' in result && !('version' in result)) {
				flash({ text: result.detail ?? 'Unknown error', isError: true });
				return;
			}

			// Now TypeScript knows result is CircuitIR
			circuitIR.set(result as CircuitIR);
			triggerSimulation(result as CircuitIR);
			editorContent = buildCanonicalString(result as CircuitIR);
			flash({ text: 'Canonical IR loaded successfully!' });
		} catch {
			flash({ text: 'Invalid JSON format', isError: true });
		}

		isEnlarged = false;
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
		editorContent = content;
		downloadFile('circuit.cir', content, 'text/plain');
		flash({ text: 'Canonical IR downloaded!' });
	}

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(editorContent);
			flash({ text: 'Copied to clipboard!' });
		} catch {
			flash({ text: 'Failed to copy text. Please copy manually.', isError: true });
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
	class="relative mb-4 w-[96%] h-auto py-4 flex flex-wrap justify-center gap-3 rounded-sm border border-secondary-3"
>
	{#each gates as gate}
		{#if !isSingleQubit || gate.type !== 'CONTROL'}
			<!-- Separator before multi-qubit gates -->
			{#if gate.category === 'multi' && !isSingleQubit && gate.type === 'CONTROL'}
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
					['CONTROL', 'MEASURE'].includes(gate.type)
						? 'h-11 w-10 rounded-sm border-secondary-4'
						: 'rounded-sm border-secondary-4 px-3.5 py-2 text-base font-medium text-secondary-2'
				}`}
			>
				{#if gate.type === 'CONTROL'}
					<span class="h-3 w-3 rounded-full bg-secondary-4"></span>
				{:else if gate.type === 'MEASURE'}
					<span class="text-secondary-4">
						<Icon icon="si:meter-fill" width="20" height="20" />
					</span>
				{:else}
					{gate.name}
				{/if}
			</div>
		{/if}
	{/each}

	<div class="absolute top-2 right-4 cursor-pointer dropdown-container">
		<button
			type="button"
			class="flex items-center gap-2 cursor-pointer"
			on:click={() => (dropdownOpen = !dropdownOpen)}
		>
			<Icon
				icon="icon-park-solid:down-one"
				width="20"
				height="20"
				class="text-white"
				style={dropdownOpen
					? 'transform: rotate(180deg); transition: transform 0.2s ease;'
					: 'transition: transform 0.2s ease;'}
			/>
		</button>

		{#if dropdownOpen}
			<div
				class="absolute top-full right-0 mt-1 bg-white border border-secondary-3 rounded-sm shadow-md z-60 min-w-30"
			>
				<button
					type="button"
					on:click={openCircuitDataModal}
					class="whitespace-nowrap py-2 w-full text-center border border-b-gray-400 rounded-t-sm border-white text-secondary-2 cursor-pointer active:text-secondary-3 active:border-secondary-3"
				>
					Circuit Data
				</button>

				<button
					type="button"
					on:click={() => resetCircuit()}
					class="whitespace-nowrap w-full py-2 text-center font-semibold rounded-b-sm border border-white active:border-ternary-2 text-ternary-2 cursor-pointer active:text-ternary-2"
				>
					Reset Circuit
				</button>
			</div>
		{/if}
	</div>
</div>

<CircuitDataModal
	open={isEnlarged}
	{activeView}
	bind:value={editorContent}
	{message}
	{errorMessage}
	onClose={closeModal}
	onTabChange={handleTabChange}
	onCopy={copyToClipboard}
	onDownload={exportCurrentView}
	onImport={importJson}
	{shake}
/>

<style>
	.ghost-gate {
		pointer-events: none;
		opacity: 0.8;
	}
</style>
