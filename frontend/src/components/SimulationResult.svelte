<script lang="ts">
	import { simulationResult } from '$lib/IR/stores';
	import { circuitIR } from '$lib/IR/stores';
	import { settings, updateSettings } from '$lib/stores/settingsStore';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import Icon from '@iconify/svelte';

	let activeTooltip: { quick: string; detail: string; side: 'top' | 'left' } | null = null;
	let tooltipX = 0;
	let tooltipY = 0;

	function showTooltip(e: MouseEvent, quick: string, detail: string, side: 'top' | 'left' = 'top') {
		e.stopPropagation();
		if (activeTooltip?.quick === quick) {
			activeTooltip = null;
			return;
		}
		const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
		if (side === 'left') {
			tooltipX = rect.right;
			tooltipY = rect.top + rect.height / 2;
		} else {
			tooltipX = rect.left + rect.width / 2;
			tooltipY = rect.top;
		}
		activeTooltip = { quick, detail, side };
	}

	let popupWindow: Window | null = null;
	let popupRebuildTimer: ReturnType<typeof setTimeout> | undefined;

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

	function hexToRgb(hex: string): string {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}` : '0,0,0';
	}

	function getThemeColors() {
		const s = getComputedStyle(document.documentElement);
		const get = (v: string) => s.getPropertyValue(v).trim();
		return {
			bg: get('--color-background'),
			surface: get('--color-surface'),
			text: get('--color-text'),
			border: get('--color-border'),
			muted: get('--color-muted'),
			secondary1: get('--color-secondary-1'),
			secondary2: get('--color-secondary-2'),
			secondary3: get('--color-secondary-3'),
			secondary4: get('--color-secondary-4'),
			ternary1: get('--color-ternary-1'),
			ternary2: get('--color-ternary-2'),
			ternary3: get('--color-ternary-3'),
			measured: get('--color-measured'),
			probability: get('--color-probability'),
		};
	}

	// `stateText` must already be in display order (pass it through displayBasis /
	// displayFormattedState first). `order` maps each character position to its qubit.
	function coloredStateHtml(stateText: string, measuredQubits: number[], measuredColor: string, order: number[]): string {
		let bitsStr = stateText;
		const pipeIndex = stateText.indexOf('|');
		if (pipeIndex !== -1) {
			const closingIndex = stateText.indexOf('⟩');
			bitsStr = stateText.substring(pipeIndex + 1, closingIndex);
		}

		const coloredBits = Array.from(bitsStr)
			.map((bit, i) => {
				if (measuredQubits.includes(order[i] ?? i)) {
					return `<span style="color:${measuredColor};font-weight:600;">${bit}</span>`;
				}
				return bit;
			})
			.join('');

		return `|${coloredBits}⟩`;
	}

	$: probabilitiesArray = toEntriesArray($simulationResult?.probabilities);
	$: columns = chunkArray(probabilitiesArray, 4);
	$: shouldShowPopupButton = $circuitIR.registers.q >= 4;

	// ── Bit-order display (tasks 0.10–0.12) ──────────────────────────────
	// The engine always produces little-endian labels (q0 = right-most bit).
	// This layer optionally reverses the label string for display, and builds
	// a legend + a display-char-index → qubit-index map used for highlighting
	// measured qubits. Nothing here touches the simulation or the wire layout.
	$: numQubits = $circuitIR.registers.q;
	$: bitOrder = $settings.bitOrder;
	// qubitOrder[i] = which qubit the i-th character of the *displayed* label is.
	$: qubitOrder =
		bitOrder === 'q0-left'
			? Array.from({ length: numQubits }, (_, i) => i) // q0 q1 … q(n-1)
			: Array.from({ length: numQubits }, (_, i) => numQubits - 1 - i); // q(n-1) … q0
	$: legendLabels = qubitOrder.map((q) => `q${q}`);

	function displayBasis(basis: string): string {
		return bitOrder === 'q0-left' ? Array.from(basis).reverse().join('') : basis;
	}

	// Reverse the bits inside every |…⟩ token of a Dirac-notation string.
	function displayFormattedState(str: string): string {
		if (bitOrder !== 'q0-left') return str;
		return str.replace(/\|([01]+)⟩/g, (_, bits: string) => `|${Array.from(bits).reverse().join('')}⟩`);
	}

	$: showHistogram = $settings.defaultResultView === 'histogram';
	$: isMeasured = ($simulationResult.measuredQubits ?? []).length > 0;
	$: barColor = isMeasured ? 'var(--color-measured)' : 'var(--color-probability)';
	$: histogramStates = shouldShowPopupButton
		? [...probabilitiesArray].sort((a, b) => b.prob - a.prob).slice(0, 8)
		: probabilitiesArray;
	const CHART_H = 115;
	const CHART_TOP = 28;
	const CHART_LEFT = 35;
	const CHART_W = 257;

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

	function updatePopupContent() {
		if (!popupWindow || popupWindow.closed) return;

		const colors = getThemeColors();

		const measuredQubitsHtml =
			$simulationResult.measuredQubits && $simulationResult.measuredQubits.length > 0
				? `
			<p style="margin:12px 0 8px;">
				<strong>Measured Qubits:</strong>
				<span style="color:${colors.measured};font-weight:600;background:rgba(${hexToRgb(colors.measured)},0.15);padding:4px 8px;border-radius:4px;display:inline-block;">
					${$simulationResult.measuredQubits.map(q => `q${q}`).join(', ')}
				</span>
			</p>`
				: '';

		const classicalHtml =
			$simulationResult.classicalBits && $simulationResult.classicalBits.size > 0
				? `
			<p style="margin:12px 0 20px;">
				<strong>Classical bits after measurement:</strong>
				<span style="color:${colors.measured};font-weight:600;background:rgba(${hexToRgb(colors.measured)},0.15);padding:4px 8px;border-radius:4px;display:inline-block;">
					${Array.from($simulationResult.classicalBits.entries())
						.map(([q, v]) => `q${q}=${v}`)
						.join(', ')}
				</span>
			</p>`
				: '';

		const probRows = toEntriesArray($simulationResult?.probabilities)
			.map((item) => {
				const isZero = item.prob === 0;
				const measuredQubits = $simulationResult.measuredQubits || [];
				const coloredBits = coloredStateHtml(displayBasis(item.state), measuredQubits, colors.measured, qubitOrder).substring(1).slice(0, -1);
				return `
			<div class="row">
				<span class="prob ${isZero ? 'zero' : 'nonzero'}">|${coloredBits}⟩</span>
				<span class="prob ${isZero ? 'zero' : 'nonzero'}">${(item.prob * 100).toFixed(4)}%</span>
			</div>`;
			})
			.join('');

		const html = `
<!DOCTYPE html>
<html>
<head>
	<title>Live Quantum Results — ${$circuitIR.registers.q} qubits</title>
	<style>
		body { font-family: system-ui, sans-serif; background:${colors.bg}; color:${colors.text}; padding:24px; margin:0; }
		.container { max-width:920px; margin:0 auto; }
		h3 { color:${colors.text}; text-align:center; }
		.live-dot { display:inline-block; width:8px; height:8px; background:${colors.ternary2}; border-radius:50%; animation: pulse 2s infinite; }
		.state { font-family:ui-monospace,monospace; text-align: center; }
		.quantum-state {text-align: center;}
		.row {
			display:flex;
			justify-content:space-between;
			padding:6px 10px;
			border-bottom:1px solid ${colors.border};
			font-family:ui-monospace,monospace;
			font-size:0.92rem;
			max-width: 380px;
			margin: 0 auto;
		}
		.prob { font-weight:600; }
		.nonzero { color:${colors.probability}; }
		.zero { color:${colors.muted}; }
		.note { margin-top:32px; font-size:0.9rem; opacity:0.75; border-top:1px solid ${colors.border}; padding-top:16px; }
		.header-row {
			display: flex;
			justify-content: space-between;
			padding: 8px 10px;
			border-bottom: 2px solid ${colors.secondary2};
			margin-bottom: 4px;
			font-weight: 700;
			color: ${colors.text};
			max-width: 380px;
			margin-left: auto;
			margin-right: auto;
		}

		.header {
			font-size: 0.95rem;
		}
		.probabilities-container {
			background: rgba(${hexToRgb(colors.ternary3)}, 0.15);
			border-radius: 4px;
			padding: 16px;
			margin-top: 16px;
			box-shadow: 0 1px 2px rgba(${hexToRgb(colors.ternary1)}, 0.3);
		}
		@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }
	</style>
</head>
<body>
	<div class="container">
		<h3>Live Simulation Results <span class="live-dot"></span></h3>
		<p class="quantum-state"><strong>Quantum State:</strong> <span class="state">${
			$simulationResult.formattedState && $simulationResult.measuredQubits && $simulationResult.measuredQubits.length > 0
				? coloredStateHtml(displayFormattedState($simulationResult.formattedState), $simulationResult.measuredQubits, colors.measured, qubitOrder)
				: $simulationResult.formattedState ? displayFormattedState($simulationResult.formattedState) : 'Calculating...'
		}</span></p>

		${measuredQubitsHtml}
		${classicalHtml}

		<div class="probabilities-container">
			<div class="header-row">
				<span class="header">|${legendLabels.join(' ')}⟩</span>
				<span class="header">Probabilities</span>
			</div>

			${probRows}
		</div>

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

	// Rebuilding the popup does a full document.write, so coalesce rapid store
	// changes (e.g. dragging several gates) into a single rebuild once they settle.
	function schedulePopupUpdate() {
		if (!popupWindow || popupWindow.closed) return;
		clearTimeout(popupRebuildTimer);
		popupRebuildTimer = setTimeout(() => {
			if (popupWindow && !popupWindow.closed) updatePopupContent();
		}, 150);
	}

	$: if (popupWindow && !popupWindow.closed && $circuitIR.registers.q < 3) {
		popupWindow.close();
		popupWindow = null;
	}

	// Refresh an open results popup when the bit-order preference changes (the
	// popup isn't rebuilt by circuit/sim changes for a pure display-setting flip).
	$: if (bitOrder && popupWindow && !popupWindow.closed) schedulePopupUpdate();

	onMount(() => {
		const unsubCircuit = circuitIR.subscribe(() => {
			schedulePopupUpdate();
		});

		const unsubSim = simulationResult.subscribe(() => {
			schedulePopupUpdate();
		});

		return () => {
			unsubCircuit();
			unsubSim();
			clearTimeout(popupRebuildTimer);
			if (popupWindow && !popupWindow.closed) popupWindow.close();
		};
	});
</script>

<svelte:window on:click={() => (activeTooltip = null)} />

<div class="h-full flex flex-col" style="color: var(--color-text)">
	<!-- View toggle -->
	<div class="flex items-center justify-end px-3 pt-2 shrink-0">
		<button
			type="button"
			on:click={() => updateSettings({ defaultResultView: showHistogram ? 'list' : 'histogram' })}
			class="p-1 rounded cursor-pointer transition-colors"
			style="color: var(--color-muted);"
			title={showHistogram ? 'Switch to list view' : 'Switch to histogram'}
		>
			<Icon icon={showHistogram ? 'ph:list-bold' : 'ph:chart-bar-bold'} width="20" height="20" />
		</button>
	</div>

	{#if showHistogram}
		<!-- Histogram view — shows 8 states for 3 qubits -->
		{@const n = histogramStates.length}
		{@const slotW = n > 0 ? CHART_W / n : CHART_W}
		{@const barW = slotW * 0.55}
		<div class="flex-1 min-h-0 px-2 pb-2" in:fade={{ duration: 350 }}>
			<svg viewBox="0 0 300 215" class="w-full h-full" role="img" aria-label="Probability histogram">
				<!-- Gridlines at 0%, 25%, 50%, 75%, 100% -->
				{#each [0, 0.25, 0.5, 0.75, 1] as tick}
					{@const y = CHART_TOP + CHART_H - tick * CHART_H}
					<line x1={CHART_LEFT} x2={CHART_LEFT + CHART_W} y1={y} y2={y}
						stroke="var(--color-ternary-2)" stroke-width={tick === 0 ? 1 : 0.5} />
					<text x={CHART_LEFT - 3} y={y + 4} text-anchor="end" font-size="13"
						fill="var(--color-muted)">{Math.round(tick * 100)}%</text>
				{/each}
				<!-- Bars -->
				{#each histogramStates as item, i}
					{@const barH = item.prob * CHART_H}
					{@const x = CHART_LEFT + i * slotW + (slotW - barW) / 2}
					{@const cx = x + barW / 2}
					{@const barY = CHART_TOP + CHART_H - barH}
					<rect class="histogram-bar" x={x} y={barY} width={barW} height={barH}
						style="animation-delay: {i * 60}ms"
						fill={item.prob > 0 ? barColor : 'var(--color-ternary-2)'}
						rx="1.5" />
					{#if item.prob > 0.015}
						<text x={cx} y={barY - 3} text-anchor="middle" font-size="10"
							fill={barColor} font-weight="600">
							{(item.prob * 100).toFixed(1)}%
						</text>
					{/if}
					<!-- State label, rotated -->
					<text
						x={cx} y={CHART_TOP + CHART_H + 7}
						text-anchor="end"
						font-size="13"
						fill="var(--color-muted)"
						font-family="ui-monospace,monospace"
						transform="rotate(-45 {cx} {CHART_TOP + CHART_H + 7})"
					>|{displayBasis(item.state)}⟩</text>
				{/each}
			</svg>
		</div>
		<div class="flex flex-col items-center gap-1">
			<p class="bit-legend" title="Each character in a state label is this qubit.">|{legendLabels.join(' ')}⟩</p>
			<div class="flex items-center justify-center gap-1.5">
				<button type="button" class="info-btn" on:click={(e) => showTooltip(e, 'Probability Histogram', 'Each bar shows the probability of measuring that bit string. Taller bars are more likely outcomes. Only the top 8 states are shown — click "View All States" for the full list.', 'left')} aria-label="More info">i</button>
				<p class="text-xs text-center" style="color: var(--color-muted);">Showing 8 top states.</p>
			</div>
		</div>
	{:else if shouldShowPopupButton}
		{@const nonZero = probabilitiesArray.filter(p => p.prob > 0)}
		{@const top3 = [...probabilitiesArray].sort((a, b) => b.prob - a.prob).slice(0, 3)}
		{@const totalStates = Math.pow(2, $circuitIR.registers.q)}
		<div class="p-4 flex flex-col gap-3">
			<!-- Header -->
			<div class="flex items-center justify-between">
				<p class="text-base font-semibold" style="color: var(--color-branding);">
					{$circuitIR.registers.q} Qubits
				</p>
				<span class="text-sm px-2 py-0.5 rounded-sm" style="background: color-mix(in srgb, var(--color-branding) 15%, transparent); color: var(--color-branding);">
					{nonZero.length} / {totalStates} states
				</span>
			</div>

			<!-- Quantum state -->
			{#if $simulationResult.formattedState}
				<p class="text-sm font-mono truncate" style="color: var(--color-muted);" title={displayFormattedState($simulationResult.formattedState)}>
					{displayFormattedState($simulationResult.formattedState)}
				</p>
			{/if}

			<!-- Measured qubits -->
			{#if ($simulationResult.measuredQubits ?? []).length > 0}
				<p class="text-sm font-medium flex items-center gap-1.5">
					Measured:
					<span class="font-semibold px-1.5 py-0.5 rounded text-sm" style="color: var(--color-measured); background: color-mix(in srgb, var(--color-measured) 15%, transparent);">
						{($simulationResult.measuredQubits ?? []).map(q => `q${q}`).join(', ')}
					</span>
					<button type="button" class="info-btn" on:click={(e) => showTooltip(e, 'Measured Qubits', 'These qubits have been collapsed to a definite 0 or 1 using Born\'s rule. Their state is no longer in superposition — further gates applied to them will have no quantum effect.')} aria-label="More info">i</button>
				</p>
			{/if}

			<!-- Classical bits -->
			{#if ($simulationResult.classicalBits?.size ?? 0) > 0}
				<p class="text-sm font-medium flex items-center gap-1.5">
					Classical:
					<span class="font-semibold px-1.5 py-0.5 rounded text-sm" style="color: var(--color-measured); background: color-mix(in srgb, var(--color-measured) 15%, transparent);">
						{Array.from(($simulationResult.classicalBits ?? new Map()).entries()).map(([q, v]) => `q${q}=${v}`).join(', ')}
					</span>
					<button type="button" class="info-btn" on:click={(e) => showTooltip(e, 'Classical Bits', 'The definite 0 or 1 outcome recorded after measuring each qubit. This is the result a real quantum computer would return to your classical program.')} aria-label="More info">i</button>
				</p>
			{/if}

			<!-- Top 3 states -->
			{#if top3.length > 0}
				<div>
					<div class="flex items-center justify-between gap-1.5 mb-1">
						<div class="flex items-center gap-1.5">
							<button type="button" class="info-btn" on:click={(e) => showTooltip(e, 'Top States', 'The three most probable measurement outcomes. For the full probability distribution across all states, click "View All States" below.')} aria-label="More info">i</button>
							<p class="text-sm font-medium" style="color: var(--color-muted);">Top states</p>
						</div>
						<span class="bit-legend" title="Each character in a state label is this qubit.">|{legendLabels.join(' ')}⟩</span>
					</div>
					{#each top3 as item}
						<div class="flex justify-between items-center py-1 border-b text-sm font-mono" style="border-color: var(--color-ternary-2);">
							<span style="color: {item.prob > 0 ? 'var(--color-probability)' : 'var(--color-muted)'}; font-weight: 600;">|{displayBasis(item.state)}⟩</span>
							<span style="color: {item.prob > 0 ? 'var(--color-probability)' : 'var(--color-muted)'}; font-weight: 600;">{(item.prob * 100).toFixed($settings.probabilityDecimals)}%</span>
						</div>
					{/each}
				</div>
			{/if}


			<!-- Full results button -->
			<button
				type="button"
				class="mt-1 w-full px-4 py-2 cursor-pointer text-sm font-medium rounded-sm border" style="color: var(--color-branding); border-color: var(--color-branding);"
				on:click={openResultsInNewWindow}
			>
				View All {totalStates} States
			</button>
		</div>
	{:else}
		<!-- Compact inline view for 1-2 qubits -->
		<div class="flex items-center gap-1.5 flex-wrap">
			<button type="button" class="info-btn" on:click={(e) => showTooltip(e, 'Quantum State', 'The full state of your qubits in Dirac notation. Each |x⟩ term is a possible outcome — the coefficient in front is its probability amplitude.', 'left')} aria-label="More info">i</button>
			<p class="text-base font-medium">
				Quantum State:
				<span class="text-sm font-normal">
					{#if $simulationResult.formattedState}
						{@const stateText = displayFormattedState($simulationResult.formattedState)}
						{@const pipeIndex = stateText.indexOf('|')}
						{@const closingIndex = stateText.indexOf('⟩')}
						{@const bitsStr = stateText.substring(pipeIndex + 1, closingIndex)}
						{stateText.substring(0, pipeIndex + 1)}
						{#each Array.from(bitsStr) as bit, i (i)}
							<span style={$simulationResult.measuredQubits?.includes(qubitOrder[i] ?? i) ? 'color: var(--color-measured); font-weight: 600;' : ''}>
								{bit}
							</span>
						{/each}
						⟩
					{:else}
						Calculating...
					{/if}
				</span>
			</p>
		</div>

		{#if $simulationResult.measuredQubits && $simulationResult.measuredQubits.length > 0}
			<div class="flex items-center gap-1.5 mt-3">
				<p class="text-md font-medium">Measured Qubits:</p>
				<span class="font-semibold px-2 py-1 rounded" style="color: var(--color-measured); background-color: color-mix(in srgb, var(--color-measured) 15%, transparent);">
					{$simulationResult.measuredQubits.map(q => `q${q}`).join(', ')}
				</span>
				<button type="button" class="info-btn" on:click={(e) => showTooltip(e, 'Measured Qubits', 'These qubits have been collapsed to a definite 0 or 1 using Born\'s rule. Their state is no longer in superposition — further gates applied to them will have no quantum effect.')} aria-label="More info">i</button>
			</div>
		{/if}

		{#if $simulationResult.classicalBits && $simulationResult.classicalBits.size > 0}
			<div class="flex items-center gap-1.5 mt-3">
				<p class="text-md font-medium">Classical bits:</p>
				<span class="font-semibold px-2 py-1 rounded" style="color: var(--color-measured); background-color: color-mix(in srgb, var(--color-measured) 15%, transparent);">
					{Array.from($simulationResult.classicalBits.entries())
						.map(([qubit, value]) => `q${qubit} = ${value}`)
						.join(', ')}
				</span>
				<button type="button" class="info-btn" on:click={(e) => showTooltip(e, 'Classical Bits', 'The definite 0 or 1 outcome recorded after measuring each qubit. This is the result a real quantum computer would return to your classical program.')} aria-label="More info">i</button>
			</div>
		{/if}

		<div class="flex items-center justify-between gap-1.5 mt-5">
			<div class="flex items-center gap-1.5">
				<button type="button" class="info-btn" on:click={(e) => showTooltip(e, 'Probabilities', 'The chance of measuring each possible bit string. All values sum to 100%. States with 0% are theoretically possible but will never occur in practice.', 'left')} aria-label="More info">i</button>
				<p class="text-md font-medium">Probabilities:</p>
			</div>
			<span class="bit-legend" title="Each character in a state label is this qubit — the top wire is q0.">|{legendLabels.join(' ')}⟩</span>
		</div>

		{#if columns.length > 0}
			<div class="prob-columns" role="list">
				{#each columns as column}
					<div class="prob-column" role="listitem">
						{#each column as item}
							<div class="prob-row">
								<span style="color: {item.prob > 0 ? 'var(--color-probability)' : 'var(--color-muted)'}; font-weight: 600;"
									>|{displayBasis(item.state)}⟩</span
								>
								<span style="color: {item.prob > 0 ? 'var(--color-probability)' : 'var(--color-muted)'}; font-weight: 600;">
									{(item.prob * 100).toFixed($settings.probabilityDecimals)}%
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

{#if activeTooltip}
	<div
		class="fixed z-200 w-72 rounded-md shadow-lg px-3 py-2 text-xs pointer-events-none"
		style="left: {tooltipX}px; top: {tooltipY}px;
			   transform: {activeTooltip.side === 'left' ? 'translate(8px, -50%)' : 'translate(-50%, calc(-100% - 8px))'};
			   background-color: var(--color-surface);
			   border: 1px solid var(--color-border);
			   color: var(--color-text);"
	>
		<p class="font-semibold mb-0.5">{activeTooltip.quick}</p>
		<p style="color: var(--color-muted);">{activeTooltip.detail}</p>
	</div>
{/if}

<style>
	.info-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 9999px;
		border: 1px solid var(--color-ternary-1);
		color: var(--color-ternary-1);
		background: var(--color-surface);
		font-size: 7px;
		cursor: pointer;
		flex-shrink: 0;
		margin-bottom: 10px;
	}

	.histogram-bar {
		transform-box: fill-box;
		transform-origin: bottom center;
		animation: bar-grow 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	@keyframes bar-grow {
		from { transform: scaleY(0); opacity: 0; }
		to   { transform: scaleY(1); opacity: 1; }
	}

	.bit-legend {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace;
		font-size: 0.8rem;
		letter-spacing: 0.05em;
		color: var(--color-muted);
		opacity: 0.85;
		cursor: help;
	}

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
		border-bottom: 1.5px solid var(--color-ternary-2);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace;
		font-size: 0.95rem;
	}
</style>
