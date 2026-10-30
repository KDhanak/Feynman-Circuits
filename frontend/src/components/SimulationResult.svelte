<script lang="ts">
	import { simulationResult } from '$lib/IR/stores';
	import { circuitIR } from '$lib/IR/stores';
	import { settings, updateSettings } from '$lib/stores/settingsStore';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import { browser } from '$app/environment';

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
		return result
			? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`
			: '0,0,0';
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
			probability: get('--color-probability')
		};
	}

	// `stateText` must already be in display order (pass it through displayBasis /
	// displayFormattedState first). `order` maps each character position to its qubit.
	function coloredStateHtml(
		stateText: string,
		measuredQubits: number[],
		measuredColor: string,
		order: number[]
	): string {
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
	// The simulator always makes labels with q0 as the rightmost bit.
	// This part can flip the label text for display, and builds a legend plus a
	// map from each displayed character to its qubit, used to highlight
	// measured qubits. Nothing here changes the simulation or the wire layout.
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
		return str.replace(
			/\|([01]+)⟩/g,
			(_, bits: string) => `|${Array.from(bits).reverse().join('')}⟩`
		);
	}

	$: showHistogram = $settings.defaultResultView === 'histogram';
	$: isMeasured = ($simulationResult.measuredQubits ?? []).length > 0;
	$: barColor = isMeasured ? 'var(--color-measured)' : 'var(--color-probability)';
	// Past 3 qubits the full basis is too wide to plot, so only the most likely
	// states get bars; the popup window still lists every state.
	const HISTOGRAM_TOP_N = 10;
	$: histogramStates = shouldShowPopupButton
		? [...probabilitiesArray].sort((a, b) => b.prob - a.prob).slice(0, HISTOGRAM_TOP_N)
		: probabilitiesArray;

	// The chart used to draw into a fixed 300×215 viewBox, which `preserveAspect-
	// Ratio` then shrank to fit inside the (much wider) panel, so the plot stayed
	// small and the sides were empty. Now we read the wrapper's real size and use
	// it as the viewBox, so 1 unit === 1px. The plot fills the panel and redraws
	// when the results row is resized.
	let chartBoxW = 0;
	let chartBoxH = 0;
	// "100%" is the widest tick label. At TICK_FONT it is about 29px wide, and its
	// right end sits 3px inside the axis margin. 34px with a 13px font cut off the
	// first "1" at the left edge on every screen size.
	const TICK_FONT = 11;
	const TICK_GUTTER = 36; // room for the 0–100% tick labels
	const CHART_TOP = 14; // room for the value label above a full-height bar
	const AXIS_RIGHT = 6; // keeps the last bar off the panel edge
	const LABEL_FONT = 13;
	// Measuring the viewBox goes in a circle when the wrapper has no fixed height:
	// the box takes its size from the SVG, the SVG takes its size from the box, and
	// both end up at zero. The CSS gives the wrapper a real height on every screen
	// size, but this is a backup so a zero measurement doesn't make the chart blank.
	// Using an aspect ratio instead still gives a viewBox, and an SVG with a viewBox
	// and an auto height draws at its natural ratio. This also covers the very first
	// draw, before the ResizeObserver behind bind:clientHeight has given a size.
	$: boxH = chartBoxH > 0 ? chartBoxH : Math.round(chartBoxW * 0.62);
	// State labels are rotated -45° around their end point, so we must keep space
	// free below and to the left of that point, or the edge of the SVG cuts them off.
	//
	// The text width is measured, not guessed from the number of letters: a canvas
	// (not on the page) with the same font gives exactly the same width as the SVG's
	// own getComputedTextLength, without touching the page or laying it out twice.
	let measureCtx: CanvasRenderingContext2D | null = null;
	function measureLabel(text: string, font: number): number {
		if (!browser) return text.length * font * 0.62; // SSR: a guess is fine here, it is measured again once the page loads
		measureCtx ??= document.createElement('canvas').getContext('2d');
		if (!measureCtx) return text.length * font * 0.62;
		measureCtx.font = `${font}px ui-monospace, monospace`;
		return measureCtx.measureText(text).width;
	}
	// Widest possible label for this register — every basis state is the same length.
	$: longestLabel = `|${'0'.repeat(Math.max(1, numQubits))}⟩`;
	$: labelW = measureLabel(longestLabel, LABEL_FONT);

	// When you rotate a box, BOTH its width and height add to how far it reaches
	// in each direction. This is easy to get wrong: the text is not a thin line, it
	// is a labelW × lineHeight box, and at -45° its leftmost corner is also its
	// highest one. So the reach to the left is (labelW + ascent)·sin45, not
	// labelW·sin45. Leaving out the ascent keeps exactly 7px too little space,
	// which is what cut off |00000000⟩ at 8 qubits. Going down, the matching corner
	// is the lowest one, which gives (labelW + descent)·sin45 plus the 7px that the
	// anchor already sits below the baseline.
	const SIN45 = 0.7071;
	const ASCENT = 0.95; // part of the font size that is above the baseline, rounded up
	const DESCENT = 0.25;
	$: labelReachX = (labelW + LABEL_FONT * ASCENT) * SIN45;
	$: labelReachY = (labelW + LABEL_FONT * DESCENT) * SIN45 + 7;

	// Limited so long labels on many qubits can't squeeze the chart area to nothing.
	$: labelGutter = Math.min(Math.ceil(labelReachY) + 2, Math.round(boxH * 0.45));

	// The FIRST bar's label reaches left from the centre of its slot, so the axis
	// margin must be at least `labelReachX − slotW/2`. But that depends on slotW,
	// and slotW depends on the margin. So we just repeat the calculation a few
	// times. The two affect each other only a little (the margin is a small part of
	// the width), so after three rounds the answer is correct to well under a pixel.
	$: barCount = histogramStates.length;
	$: axisLeft = (() => {
		let gutter = TICK_GUTTER;
		for (let i = 0; i < 3; i++) {
			const width = Math.max(0, chartBoxW - gutter - AXIS_RIGHT);
			const slot = barCount > 0 ? width / barCount : width;
			gutter = Math.max(TICK_GUTTER, Math.ceil(labelReachX - slot / 2) + 2);
		}
		return gutter;
	})();

	$: plotW = Math.max(0, chartBoxW - axisLeft - AXIS_RIGHT);
	$: plotH = Math.max(0, boxH - CHART_TOP - labelGutter);

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
					${$simulationResult.measuredQubits.map((q) => `q${q}`).join(', ')}
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
				const coloredBits = coloredStateHtml(
					displayBasis(item.state),
					measuredQubits,
					colors.measured,
					qubitOrder
				)
					.substring(1)
					.slice(0, -1);
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
			border-bottom: 1px solid ${colors.border};
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
			background: ${colors.surface ?? colors.bg};
			border: 1px solid ${colors.border};
			border-radius: 8px;
			padding: 16px;
			margin-top: 16px;
		}
		@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }
	</style>
</head>
<body>
	<div class="container">
		<h3>Live Simulation Results <span class="live-dot"></span></h3>
		<p class="quantum-state"><strong>Quantum State:</strong> <span class="state">${
			$simulationResult.formattedState &&
			$simulationResult.measuredQubits &&
			$simulationResult.measuredQubits.length > 0
				? coloredStateHtml(
						displayFormattedState($simulationResult.formattedState),
						$simulationResult.measuredQubits,
						colors.measured,
						qubitOrder
					)
				: $simulationResult.formattedState
					? displayFormattedState($simulationResult.formattedState)
					: 'Calculating...'
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

	// Rebuilding the popup rewrites the whole document, so when the store changes many
	// times quickly (e.g. dragging several gates), wait until it stops and rebuild once.
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

	// Refresh an open results popup when the bit-order setting changes (changing
	// only a display setting doesn't change the circuit, so nothing else would rebuild the popup).
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
		<!-- Histogram view — every state up to 3 qubits, top 10 beyond that -->
		{@const n = histogramStates.length}
		{@const slotW = n > 0 ? plotW / n : plotW}
		{@const barW = Math.min(slotW * 0.62, 72)}
		{@const baseline = CHART_TOP + plotH}
		<!-- Below `sm` the results grid has no `auto-rows`, so this row's height is
		     automatic, and `flex-1 min-h-0` alone shrinks to nothing. The min-height
		     gives the chart a real size there. From `sm` up, the row has a fixed (and
		     drag-resizable) height, so the chart fills it again. -->
		<div
			class="flex-1 min-h-64 px-1 pb-1 sm:min-h-0"
			bind:clientWidth={chartBoxW}
			bind:clientHeight={chartBoxH}
			in:fade={{ duration: 350 }}
		>
			{#if plotW > 0 && plotH > 0}
				<svg
					viewBox="0 0 {chartBoxW} {boxH}"
					class="w-full h-full"
					role="img"
					aria-label="Probability histogram"
				>
					<!-- Gridlines at 0%, 25%, 50%, 75%, 100% -->
					{#each [0, 0.25, 0.5, 0.75, 1] as tick (tick)}
						{@const y = baseline - tick * plotH}
						<line
							x1={axisLeft}
							x2={axisLeft + plotW}
							y1={y}
							y2={y}
							stroke={tick === 0 ? 'var(--color-border-strong)' : 'var(--color-border)'}
							stroke-width={tick === 0 ? 1 : 0.75}
						/>
						<text
							x={axisLeft - 3}
							y={y + 4}
							text-anchor="end"
							font-size={TICK_FONT}
							fill="var(--color-muted)">{Math.round(tick * 100)}%</text
						>
					{/each}
					<!-- Bars -->
					{#each histogramStates as item, i (i)}
						{@const barH = item.prob * plotH}
						{@const x = axisLeft + i * slotW + (slotW - barW) / 2}
						{@const cx = x + barW / 2}
						{@const barY = baseline - barH}
						<rect
							class="histogram-bar"
							{x}
							y={barY}
							width={barW}
							height={barH}
							style="animation-delay: {i * 60}ms"
							fill={item.prob > 0 ? barColor : 'var(--color-border-strong)'}
							rx="1.5"
						/>
						<!-- Value labels need about 34px of space to sit side by side without overlapping -->
						{#if item.prob > 0.015 && slotW >= 34}
							<text
								x={cx}
								y={barY - 3}
								text-anchor="middle"
								font-size="10"
								fill={barColor}
								font-weight="600"
							>
								{(item.prob * 100).toFixed(1)}%
							</text>
						{/if}
						<!-- State label, rotated -->
						<text
							x={cx}
							y={baseline + 7}
							text-anchor="end"
							font-size={LABEL_FONT}
							fill="var(--color-muted)"
							font-family="ui-monospace,monospace"
							transform="rotate(-45 {cx} {baseline + 7})">|{displayBasis(item.state)}⟩</text
						>
					{/each}
				</svg>
			{/if}
		</div>
		<div class="flex flex-col items-center gap-1">
			<p class="bit-legend" title="Each character in a state label is this qubit.">
				|{legendLabels.join(' ')}⟩
			</p>
			<div class="flex items-center justify-center gap-1.5">
				<button
					type="button"
					class="info-btn"
					on:click={(e) =>
						showTooltip(
							e,
							'Probability Histogram',
							`Each bar shows the probability of measuring that bit string. Taller bars are more likely outcomes. Beyond 3 qubits only the top ${HISTOGRAM_TOP_N} states are plotted — click "View All States" for the full list.`,
							'left'
						)}
					aria-label="More info">i</button
				>
				<p class="text-xs text-center" style="color: var(--color-muted);">
					{histogramStates.length === probabilitiesArray.length
						? `Showing all ${histogramStates.length} states.`
						: `Showing top ${histogramStates.length} states.`}
				</p>
			</div>
		</div>
	{:else if shouldShowPopupButton}
		{@const nonZero = probabilitiesArray.filter((p) => p.prob > 0)}
		{@const top3 = [...probabilitiesArray].sort((a, b) => b.prob - a.prob).slice(0, 3)}
		{@const totalStates = Math.pow(2, $circuitIR.registers.q)}
		<div class="p-4 flex flex-col gap-3">
			<!-- Header -->
			<div class="flex items-center justify-between">
				<p class="text-base font-semibold" style="color: var(--color-branding);">
					{$circuitIR.registers.q} Qubits
				</p>
				<span
					class="text-sm px-2 py-0.5 rounded-sm"
					style="background: color-mix(in srgb, var(--color-branding) 15%, transparent); color: var(--color-branding);"
				>
					{nonZero.length} / {totalStates} states
				</span>
			</div>

			<!-- Quantum state -->
			{#if $simulationResult.formattedState}
				<p
					class="text-sm font-mono truncate"
					style="color: var(--color-muted);"
					title={displayFormattedState($simulationResult.formattedState)}
				>
					{displayFormattedState($simulationResult.formattedState)}
				</p>
			{/if}

			<!-- Measured qubits -->
			{#if ($simulationResult.measuredQubits ?? []).length > 0}
				<p class="text-sm font-medium flex items-center gap-1.5">
					Measured:
					<span
						class="font-semibold px-1.5 py-0.5 rounded text-sm"
						style="color: var(--color-measured); background: color-mix(in srgb, var(--color-measured) 15%, transparent);"
					>
						{($simulationResult.measuredQubits ?? []).map((q) => `q${q}`).join(', ')}
					</span>
					<button
						type="button"
						class="info-btn"
						on:click={(e) =>
							showTooltip(
								e,
								'Measured Qubits',
								"These qubits have been collapsed to a definite 0 or 1 using Born's rule. Their state is no longer in superposition — further gates applied to them will have no quantum effect."
							)}
						aria-label="More info">i</button
					>
				</p>
			{/if}

			<!-- Classical bits -->
			{#if ($simulationResult.classicalBits?.size ?? 0) > 0}
				<p class="text-sm font-medium flex items-center gap-1.5">
					Classical:
					<span
						class="font-semibold px-1.5 py-0.5 rounded text-sm"
						style="color: var(--color-measured); background: color-mix(in srgb, var(--color-measured) 15%, transparent);"
					>
						{Array.from(($simulationResult.classicalBits ?? new Map()).entries())
							.map(([q, v]) => `q${q}=${v}`)
							.join(', ')}
					</span>
					<button
						type="button"
						class="info-btn"
						on:click={(e) =>
							showTooltip(
								e,
								'Classical Bits',
								'The definite 0 or 1 outcome recorded after measuring each qubit. This is the result a real quantum computer would return to your classical program.'
							)}
						aria-label="More info">i</button
					>
				</p>
			{/if}

			<!-- Top 3 states -->
			{#if top3.length > 0}
				<div>
					<div class="flex items-center justify-between gap-1.5 mb-1">
						<div class="flex items-center gap-1.5">
							<button
								type="button"
								class="info-btn"
								on:click={(e) =>
									showTooltip(
										e,
										'Top States',
										'The three most probable measurement outcomes. For the full probability distribution across all states, click "View All States" below.'
									)}
								aria-label="More info">i</button
							>
							<p class="text-sm font-medium" style="color: var(--color-muted);">Top states</p>
						</div>
						<span class="bit-legend" title="Each character in a state label is this qubit."
							>|{legendLabels.join(' ')}⟩</span
						>
					</div>
					{#each top3 as item, i (i)}
						<div
							class="flex justify-between items-center py-1 border-b text-sm font-mono"
							style="border-color: var(--color-border);"
						>
							<span
								style="color: {item.prob > 0
									? 'var(--color-probability)'
									: 'var(--color-muted)'}; font-weight: 600;">|{displayBasis(item.state)}⟩</span
							>
							<span
								style="color: {item.prob > 0
									? 'var(--color-probability)'
									: 'var(--color-muted)'}; font-weight: 600;"
								>{(item.prob * 100).toFixed($settings.probabilityDecimals)}%</span
							>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Full results button -->
			<button type="button" class="btn-quiet mt-2 w-full !py-2" on:click={openResultsInNewWindow}>
				View All {totalStates} States
			</button>
		</div>
	{:else}
		<!-- Compact inline view for 1-2 qubits -->
		<div class="flex items-center gap-1.5 flex-wrap">
			<button
				type="button"
				class="info-btn"
				on:click={(e) =>
					showTooltip(
						e,
						'Quantum State',
						'The full state of your qubits in Dirac notation. Each |x⟩ term is a possible outcome — the coefficient in front is its probability amplitude.',
						'left'
					)}
				aria-label="More info">i</button
			>
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
							<span
								style={$simulationResult.measuredQubits?.includes(qubitOrder[i] ?? i)
									? 'color: var(--color-measured); font-weight: 600;'
									: ''}
							>
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
				<span
					class="font-semibold px-2 py-1 rounded"
					style="color: var(--color-measured); background-color: color-mix(in srgb, var(--color-measured) 15%, transparent);"
				>
					{$simulationResult.measuredQubits.map((q) => `q${q}`).join(', ')}
				</span>
				<button
					type="button"
					class="info-btn"
					on:click={(e) =>
						showTooltip(
							e,
							'Measured Qubits',
							"These qubits have been collapsed to a definite 0 or 1 using Born's rule. Their state is no longer in superposition — further gates applied to them will have no quantum effect."
						)}
					aria-label="More info">i</button
				>
			</div>
		{/if}

		{#if $simulationResult.classicalBits && $simulationResult.classicalBits.size > 0}
			<div class="flex items-center gap-1.5 mt-3">
				<p class="text-md font-medium">Classical bits:</p>
				<span
					class="font-semibold px-2 py-1 rounded"
					style="color: var(--color-measured); background-color: color-mix(in srgb, var(--color-measured) 15%, transparent);"
				>
					{Array.from($simulationResult.classicalBits.entries())
						.map(([qubit, value]) => `q${qubit} = ${value}`)
						.join(', ')}
				</span>
				<button
					type="button"
					class="info-btn"
					on:click={(e) =>
						showTooltip(
							e,
							'Classical Bits',
							'The definite 0 or 1 outcome recorded after measuring each qubit. This is the result a real quantum computer would return to your classical program.'
						)}
					aria-label="More info">i</button
				>
			</div>
		{/if}

		<div class="flex items-center justify-between gap-1.5 mt-5">
			<div class="flex items-center gap-1.5">
				<button
					type="button"
					class="info-btn"
					on:click={(e) =>
						showTooltip(
							e,
							'Probabilities',
							'The chance of measuring each possible bit string. All values sum to 100%. States with 0% are theoretically possible but will never occur in practice.',
							'left'
						)}
					aria-label="More info">i</button
				>
				<p class="text-md font-medium">Probabilities:</p>
			</div>
			<span
				class="bit-legend"
				title="Each character in a state label is this qubit — the top wire is q0."
				>|{legendLabels.join(' ')}⟩</span
			>
		</div>

		{#if columns.length > 0}
			<div class="prob-columns" role="list">
				{#each columns as column, ci (ci)}
					<div class="prob-column" role="listitem">
						{#each column as item, ii (ii)}
							<div class="prob-row">
								<span
									style="color: {item.prob > 0
										? 'var(--color-probability)'
										: 'var(--color-muted)'}; font-weight: 600;">|{displayBasis(item.state)}⟩</span
								>
								<span
									style="color: {item.prob > 0
										? 'var(--color-probability)'
										: 'var(--color-muted)'}; font-weight: 600;"
								>
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
			   transform: {activeTooltip.side === 'left'
			? 'translate(8px, -50%)'
			: 'translate(-50%, calc(-100% - 8px))'};
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
		border: 1px solid var(--color-border-strong);
		color: var(--color-muted);
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
		from {
			transform: scaleY(0);
			opacity: 0;
		}
		to {
			transform: scaleY(1);
			opacity: 1;
		}
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
		border-bottom: 1px solid var(--color-border);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace;
		font-size: 0.95rem;
	}
</style>
