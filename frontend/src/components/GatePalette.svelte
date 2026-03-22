<script lang="ts">
	import {
		handlePaletteDrop,
		handleDoubleClick,
		handleTouchStart,
		handleTouchEnd,
		handleTouchMove
	} from '$lib/dragDropUtils';
	import type { GateData, GateType, CircuitState, ImportedCircuit } from '$lib/stores';
	import { circuit, isDragging } from '$lib/stores';
	import { resetCircuit } from '$lib/simulator';
	import { importCircuit } from '$lib/IE';
	import { onMount } from 'svelte';
	import Icon from '@iconify/svelte';

	import CircuitDataModal from './CircuitDataModal.svelte';
	import { buildJsonString, buildQirString, type DataViewMode } from '$lib/circuitData';

	export const gates: { type: GateType; name: string; category: string }[] = [
		{ type: 'X', name: 'X', category: 'single' },
		{ type: 'Y', name: 'Y', category: 'single' },
		{ type: 'Z', name: 'Z', category: 'single' },
		{ type: 'H', name: 'H', category: 'single' },
		{ type: 'S', name: 'S', category: 'single' },
		{ type: 'T', name: 'T', category: 'single' },
		{ type: 'CONTROL', name: 'CONTROL', category: 'multi' }
	];

	let dropdownOpen = false;
	let isEnlarged = false;
	let activeView: DataViewMode = 'json';
	let editorContent = '';
	let message = '';
	let errorMessage = '';
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let shake = false;

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
		activeView = 'json';
		editorContent = buildJsonString($circuit);
		isEnlarged = true;
		dropdownOpen = false;
	}

	function closeModal() {
		isEnlarged = false;
	}

	function handleTabChange(mode: DataViewMode) {
		activeView = mode;

		if (mode === 'json') {
			editorContent = buildJsonString($circuit);
			return;
		}

		if (mode === 'qir') {
			editorContent = buildQirString($circuit);
		}
	}

	function importJson() {
		try {
			const input: ImportedCircuit = JSON.parse(editorContent);
			const result = importCircuit(input);

			if ('detail' in result) {
				flash({ text: result.detail ?? 'Unknown error', isError: true });
				return;
			}

			circuit.set(result as CircuitState);
			editorContent = buildJsonString(result as CircuitState);
			flash({ text: 'Circuit loaded successfully!' });
		} catch {
			flash({ text: 'Invalid JSON format', isError: true });
		}
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
		if (activeView === 'json') {
			const content = buildJsonString($circuit);
			editorContent = content;
			downloadFile('circuit.json', content, 'application/json');
			flash({ text: 'JSON downloaded!' });
			return;
		}

		if (activeView === 'qir') {
			const content = buildQirString($circuit);
			editorContent = content;
			downloadFile('circuit.qir', content, 'text/plain');
			flash({ text: 'QIR downloaded!' });
		}
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

	$: isSingleMode = $circuit.numQubits === 1;
</script>

<div
	aria-label="Quantum Circuit Gate Palette"
	role="region"
	on:drop={handlePaletteDrop}
	on:dragover={(e) => e.preventDefault()}
	on:dragenter={(e) => e.currentTarget.classList.add('drop-target-active')}
	on:dragleave={(e) => e.currentTarget.classList.remove('drop-target-active')}
	class="relative mb-2 w-14/15 h-auto py-4 flex justify-center gap-3 rounded-md border-2 border-secondary-3"
>
	{#each gates as gate}
		{#if isSingleMode ? gate.category === 'single' : true}
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
				class="cursor-grab font-medium text-md select-none rounded-md border px-3.5 py-2 bg-white text-secondary-2 active:bg-secondary-3 border-secondary-4 active:text-white active:border-white"
			>
				{gate.name}
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
				class="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-md z-50 min-w-[120px]"
			>
				<button
					type="button"
					on:click={openCircuitDataModal}
					class="whitespace-nowrap py-2 w-full text-center border border-b-gray-400 rounded-t-md border-white text-secondary-2 cursor-pointer active:text-secondary-3 active:border-secondary-3"
				>
					Circuit Data
				</button>

				<button
					type="button"
					on:click={() => resetCircuit()}
					class="whitespace-nowrap w-full py-2 text-center font-semibold rounded-b-md bg-white border border-white active:border-ternary-2 text-ternary-2 cursor-pointer active:text-ternary-2"
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
	onExport={exportCurrentView}
	onImport={importJson}
	shake={shake}
/>

<style>
	.ghost-gate {
		pointer-events: none;
		opacity: 0.8;
	}
</style>
