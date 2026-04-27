<script lang="ts">
	import { SimulationResults, circuit } from '../lib/stores';
	import { onMount, onDestroy } from 'svelte';

	let popupWindow: Window | null = null;
	let unsubscribe: (() => void) | null = null;

	function toEntriesArray(probObj: Record<string, number> | undefined) {
		if (!probObj) return [];
		return Object.entries(probObj).map(([state, prob]) => ({ state, prob }));
	}

	function chunkArray<T>(arr: T[], size: number) {
		const out: T[][] = [];
		for (let i = 0; i < arr.length; i += size) {
			out.push(arr.slice(i, i + size));
		}
		return out;
	}

	// Only used for inline view (1-2 qubits)
	$: probabilitiesArray = toEntriesArray($SimulationResults?.probabilities);
	$: columns = chunkArray(probabilitiesArray, 16);
	$: shouldShowPopupButton = $circuit.numQubits >= 3;

	// ─────────────────────────────────────────────────────────────
	// Open / focus popup
	// ─────────────────────────────────────────────────────────────
	function openResultsInNewWindow() {
		if (popupWindow && !popupWindow.closed) {
			popupWindow.focus();
			return;
		}

		popupWindow = window.open('', '_blank', 'width=960,height=780,scrollbars=yes,resizable=yes');

		if (!popupWindow) {
			alert('Popup blocked! Please allow popups for this site.');
			return;
		}

		updatePopupContent();
	}

	// ─────────────────────────────────────────────────────────────
	// Update popup with latest data + highlight non-zero probs
	// ─────────────────────────────────────────────────────────────
	function updatePopupContent() {
		if (!popupWindow || popupWindow.closed) return;

		const classicalHtml =
			$SimulationResults.classicalBits && $SimulationResults.classicalBits.size > 0
				? `
			<p style="margin:12px 0 20px;">
				<strong>Classical bits after measurement:</strong> 
				<span style="color:#67e8f9;font-weight:600;">
					${Array.from($SimulationResults.classicalBits.entries())
						.map(([q, v]) => `q${q}=${v}`)
						.join(', ')}
				</span>
			</p>`
				: '';

		const probRows = toEntriesArray($SimulationResults?.probabilities)
			.map((item) => {
				const isZero = item.prob === 0;
				return `
			<div class="row">
				<span class="prob ${isZero ? 'zero' : 'nonzero'}">|${item.state}⟩</span>
				<span class="prob ${isZero ? 'zero' : 'nonzero'}">${(item.prob * 100).toFixed(4)}%</span>
			</div>`;
			})
			.join('');

		const html = `
<!DOCTYPE html>
<html>
<head>
	<title>Live Quantum Results — ${$circuit.numQubits} qubits</title>
	<style>
		body { font-family: system-ui, sans-serif; background:#020618; color:#e2e8f0; padding:24px; margin:0; }
		.container { max-width:920px; margin:0 auto; }
		h3 { color:#e9d5ff; text-align:center; }
		.live-dot { display:inline-block; width:8px; height:8px; background:#22c55e; border-radius:50%; animation: pulse 2s infinite; }
		.state { font-family:ui-monospace,monospace; text-align: center; }
		.quantum-state {text-align: center;}
		.row { 
			display:flex; 
			justify-content:space-between; 
			padding:6px 10px; 
			border-bottom:1px solid #334155; 
			font-family:ui-monospace,monospace; 
			font-size:0.92rem;
			max-width: 380px;     /* ← Narrower row width */
			margin: 0 auto;
		}
		.prob { font-weight:600; }
		.nonzero { color:#67e8f9; }   /* bright cyan for non-zero */
		.zero { color:#64748b; }      /* muted for zero */
		.note { margin-top:32px; font-size:0.9rem; opacity:0.75; border-top:1px solid #334155; padding-top:16px; }
		.header-row {
			display: flex;
			justify-content: space-between;
			padding: 8px 10px;
			border-bottom: 2px solid #c026d3;   /* purple accent */
			margin-bottom: 4px;
			font-weight: 700;
			color: #e9d5ff;
			max-width: 380px;
			margin-left: auto;
			margin-right: auto;
		}

		.header {
			font-size: 0.95rem;
		}
		@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }
	</style>
</head>
<body>
	<div class="container">
		<h3>Live Simulation Results <span class="live-dot"></span></h3>
		<p class="quantum-state"><strong>Quantum State:</strong> <span class="state">${$SimulationResults.formattedState ?? 'Calculating...'}</span></p>

		${classicalHtml}

		<div class="header-row">
			<span class="header">States</span>
			<span class="header">Probabilities</span>
		</div>

		${probRows}

		<p class="note">
			Keep this window open.<br>
			Results update live as you change the circuit.
		</p>
	</div>
</body>
</html>`;

		popupWindow.document.open();
		popupWindow.document.write(html);
		popupWindow.document.close();
	}

	// Auto-close popup when qubits drop to ≤2
	$: if (popupWindow && !popupWindow.closed && $circuit.numQubits < 3) {
		popupWindow.close();
		popupWindow = null;
	}

	// Live subscriptions (this eliminates the 1-step lag)
	onMount(() => {
		const unsubCircuit = circuit.subscribe(() => {
			if (popupWindow && !popupWindow.closed) updatePopupContent();
		});

		const unsubSim = SimulationResults.subscribe(() => {
			if (popupWindow && !popupWindow.closed) updatePopupContent();
		});

		unsubscribe = () => {
			unsubCircuit();
			unsubSim();
		};
	});

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
		if (popupWindow && !popupWindow.closed) popupWindow.close();
	});
</script>

<div class="text-white">
	{#if shouldShowPopupButton}
		<div class="p-5 border border-secondary-3 rounded-sm bg-secondary-4/20 text-center">
			<p class="text-md font-medium">{$circuit.numQubits} qubits — Many states</p>
			<button
				type="button"
				class="mt-3 px-6 py-2.5 cursor-pointer text-sm font-medium border border-white rounded-sm"
				on:click={openResultsInNewWindow}
			>
				Open Live Results in New Window
			</button>
		</div>
	{:else}
		<!-- Compact inline view for 1-2 qubits -->
		<p class="text-md font-medium">
			Quantum State:
			<span class="text-sm font-normal">
				{$SimulationResults.formattedState ?? 'Calculating...'}
			</span>
		</p>

		{#if $SimulationResults.classicalBits && $SimulationResults.classicalBits.size > 0}
			<p class="text-md font-medium mt-3">
				Classical bits after measurement:
				<span class="text-ternary-1 font-semibold">
					{Array.from($SimulationResults.classicalBits.entries())
						.map(([qubit, value]) => `q${qubit} = ${value}`)
						.join(', ')}
				</span>
			</p>
		{/if}

		<p class="text-md font-medium mt-5">Probabilities:</p>

		{#if columns.length > 0}
			<div class="prob-columns" role="list">
				{#each columns as column}
					<div class="prob-column" role="listitem">
						{#each column as item}
							<div class="prob-row">
								<span class="state" style="color: {item.prob > 0 ? '#67e8f9' : 'var(--muted-text)'}"
									>|{item.state}⟩</span
								>
								<span class="prob" style="color: {item.prob > 0 ? '#67e8f9' : 'var(--muted-text)'}">
									{(item.prob * 100).toFixed(2)}%
								</span>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		{:else}
			<p>No probabilities available</p>
		{/if}
	{/if}
</div>

<style>
	.prob-columns {
		display: flex;
		gap: 6rem;
		overflow-x: auto;
		padding: 0.5rem 0;
		align-items: flex-start;
	}
	.prob-column {
		display: flex;
		flex-direction: column;
		min-width: 7rem;
	}
	.prob-row {
		display: flex;
		justify-content: space-between;
		padding: 0.12rem 0;
		border-bottom: 1.5px solid rgb(174, 0, 255);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace;
		font-size: 0.95rem;
	}
	.state {
		color: var(--muted-text);
	}
</style>
