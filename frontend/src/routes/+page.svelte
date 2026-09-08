<script lang="ts">
	import GatePalette from '../components/GatePalette.svelte';
	import SimulationResult from '../components/SimulationResult.svelte';
	import SignUp_In from '../components/SidePanel/AuthPanel.svelte';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { loadSession } from '$lib/auth/session';
	import { resolvedTheme, toggleTheme } from '$lib/stores/themeStore';
	import { settings, updateSettings } from '$lib/stores/settingsStore';
	import { isMobile } from '$lib/stores/isMobile';
	import OverallBlochSphere from '../components/BlochSphere/OverallBlochSphere.svelte';
	import CircuitLayout from '../components/CircuitLayout/CircuitLayout.svelte';
	import CircuitDataPanel from '../components/CircuitDataPanel.svelte';
	import Icon from '@iconify/svelte';
	import { circuitIR, currentCircuitId, currentCircuitName } from '$lib/IR/stores';
	import type { UnitaryOperation } from '$lib/IR/schema';
	import { GATE_REGISTRY, isCliffordGate } from '$lib/quantum/gates';
	import { qecMode } from '$lib/qec/stores';
	import { notification } from '$lib/stores/uiStores';
	import '$lib/circuit/autoSave';
	import { get } from 'svelte/store';
	import FeedbackModal from '../components/FeedbackModal.svelte';
	import Tooltip from '../components/Tooltip.svelte';
	import OnboardingHost from '../components/Onboarding/OnboardingHost.svelte';
	import { openWelcome } from '$lib/stores/onboardingStore';
	import HandoffDialog from '../components/HandoffDialog.svelte';
	import {
		clearHandoffFromUrl,
		readHandoffFromUrl,
		resolveHandoff,
		type ResolvedHandoff
	} from '$lib/circuit/handoff';
	import { applyCircuit } from '$lib/circuit/applyCircuit';
	import { showNotification } from '$lib/utils/notificationUtils';

	let feedbackOpen = false;

	// Entering QEC mode restricts the palette to Clifford gates, because the QEC
	// path is simulated by Stim and a stabiliser simulator cannot represent
	// anything else. Non-Clifford gates already on the board are left alone —
	// deleting the user's work silently would be worse — but they are told, since
	// that circuit will not run under Stim.
	function toggleQecMode() {
		const next = !get(qecMode);
		qecMode.set(next);
		if (!next) return;
		const offenders = [
			...new Set(
				get(circuitIR)
					.operations.filter(
						(op): op is UnitaryOperation => op.kind === 'unitary' && !isCliffordGate(op.gate)
					)
					.map((op) => GATE_REGISTRY[op.gate].label)
			)
		];
		if (offenders.length) {
			showNotification(
				`QEC mode on. The circuit still contains non-Clifford gates (${offenders.join(', ')}) — a stabiliser simulator cannot run these.`,
				'error'
			);
		}
	}

	// The Bloch sphere is optional; when it's hidden the results row reflows so
	// SimulationResult expands into the space it would have occupied.
	$: showBloch = $settings.showBlochSphere && !$isMobile;

	// The code panel can be docked to a tall left column, but only where there's
	// horizontal room for it (≥1024px). Below that it stays in the bottom slot.
	let isWideScreen = false;
	onMount(() => {
		const mq = window.matchMedia('(min-width: 1024px)');
		isWideScreen = mq.matches;
		const handler = (e: MediaQueryListEvent) => (isWideScreen = e.matches);
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	});
	$: leftMode = $settings.codePanelPosition === 'left' && isWideScreen;

	// Results-grid column template. In left-dock mode the code panel is elsewhere,
	// so the grid only lays out Sim (+ Bloch) inside the narrower right column.
	$: resultsGridCols = leftMode
		? showBloch
			? 'lg:grid-cols-2'
			: 'lg:grid-cols-1'
		: showBloch
			? 'lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)_auto]'
			: 'lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]';
	// In the bottom layout with no Bloch, Sim spans the full width; not needed
	// in left-dock mode (Sim already fills its column there).
	$: simSpan = !leftMode && !showBloch ? 'sm:col-span-2 lg:col-span-1' : '';

	// In bottom mode the board/results centre themselves at 96% like the palette.
	// In left mode they fill the right column so their right edge lines up with
	// the palette above (the column itself is already 96%-aligned).
	$: contentWidth = leftMode ? 'w-full' : 'w-[96%] max-w-420 mx-auto';

	// ── Draggable divider for the left-docked code panel ─────────────────
	// `codePanelWidth` is the desired px width; the applied style clamps it to
	// [280px, 65%] so the right column always keeps room. Persisted on drag end.
	let splitRowEl: HTMLDivElement | undefined;
	let dragging = false;
	let codePanelWidth = get(settings).codePanelWidthPx;
	const MIN_LEFT = 280;

	function clampWidth(px: number): number {
		if (!splitRowEl) return Math.max(MIN_LEFT, px);
		const max = splitRowEl.clientWidth * 0.65;
		return Math.max(MIN_LEFT, Math.min(px, max));
	}

	function startDrag(e: PointerEvent) {
		dragging = true;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.preventDefault();
	}
	function onDrag(e: PointerEvent) {
		if (!dragging || !splitRowEl) return;
		codePanelWidth = clampWidth(e.clientX - splitRowEl.getBoundingClientRect().left);
	}
	function endDrag(e: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		try {
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		} catch {
			/* pointer may already be released */
		}
		updateSettings({ codePanelWidthPx: Math.round(codePanelWidth) });
	}
	function onHandleKey(e: KeyboardEvent) {
		const STEP = 16;
		if (e.key === 'ArrowLeft') codePanelWidth = clampWidth(codePanelWidth - STEP);
		else if (e.key === 'ArrowRight') codePanelWidth = clampWidth(codePanelWidth + STEP);
		else return;
		e.preventDefault();
		updateSettings({ codePanelWidthPx: Math.round(codePanelWidth) });
	}

	// ── Draggable divider between the board and the results row ──────────
	// Only active ≥1024px, where <main> is h-screen and the board is `lg:flex-1
	// lg:min-h-0` — so shrinking the results row hands that space straight back
	// to the board. Below that the page scrolls and the row keeps its CSS height.
	let boardEl: HTMLDivElement | undefined;
	let vDragging = false;
	let resultsHeight = get(settings).resultsRowHeightPx;
	const MIN_RESULTS = 160;
	const MIN_BOARD = 220;
	// Captured at pointerdown: board + results is a constant during a drag, so the
	// ceiling can be fixed up front instead of re-measuring a moving layout.
	let vStartY = 0;
	let vStartHeight = 0;
	let vMaxHeight = Number.POSITIVE_INFINITY;

	function clampHeight(px: number): number {
		return Math.max(MIN_RESULTS, Math.min(px, vMaxHeight));
	}

	function startVDrag(e: PointerEvent) {
		vDragging = true;
		vStartY = e.clientY;
		vStartHeight = resultsHeight;
		vMaxHeight = boardEl ? resultsHeight + boardEl.clientHeight - MIN_BOARD : 1200;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.preventDefault();
	}
	function onVDrag(e: PointerEvent) {
		if (!vDragging) return;
		// Dragging up (smaller clientY) grows the results row.
		resultsHeight = clampHeight(vStartHeight + (vStartY - e.clientY));
	}
	function endVDrag(e: PointerEvent) {
		if (!vDragging) return;
		vDragging = false;
		try {
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		} catch {
			/* pointer may already be released */
		}
		updateSettings({ resultsRowHeightPx: Math.round(resultsHeight) });
	}
	function onVHandleKey(e: KeyboardEvent) {
		const STEP = 16;
		// Keyboard nudges skip pointerdown, so establish the ceiling here too.
		vMaxHeight = boardEl ? resultsHeight + boardEl.clientHeight - MIN_BOARD : 1200;
		if (e.key === 'ArrowUp') resultsHeight = clampHeight(resultsHeight + STEP);
		else if (e.key === 'ArrowDown') resultsHeight = clampHeight(resultsHeight - STEP);
		else return;
		e.preventDefault();
		updateSettings({ resultsRowHeightPx: Math.round(resultsHeight) });
	}

	// Only initialize on first load — stores survive HMR so skip re-init
	if (!get(currentCircuitId)) {
		currentCircuitId.set(crypto.randomUUID());
		currentCircuitName.set('Untitled Circuit');
	}

	// --- Shared-circuit links ------------------------------------------------
	// A share link can carry a circuit. Resolved on the client rather than in a
	// `+page.ts` load: the inline form lives in the URL fragment, which never
	// reaches the server, so a universal load could not see it anyway.
	let pendingHandoff: ResolvedHandoff | null = null;
	let handoffError: string | null = null;

	function acceptHandoff() {
		if (!pendingHandoff) return;
		const { ir, name, circuitId } = pendingHandoff;
		// A circuit published from this app keeps its identity so the visitor can
		// tell it is the same circuit; anything from elsewhere gets a fresh local
		// id, and neither is treated as already-saved — this visitor does not own
		// it until they save it themselves.
		applyCircuit(ir, { id: circuitId, name, saved: false });
		showNotification(`"${name}" loaded.`, 'success');
		dismissHandoff();
	}

	function dismissHandoff() {
		pendingHandoff = null;
		handoffError = null;
		// Drop the param so a refresh does not reload the handoff over the user's edits.
		clearHandoffFromUrl();
	}

	onMount(() => {
		loadSession();

		const handoff = readHandoffFromUrl(new URL(window.location.href));
		if (!handoff) return;
		resolveHandoff(handoff)
			.then((resolved) => {
				pendingHandoff = resolved;
			})
			.catch((err) => {
				handoffError =
					err instanceof Error
						? err.message
						: 'That circuit link could not be opened. It may have expired.';
			});
	});
</script>

<main
	class="flex pb-20 sm:pb-0 min-h-screen lg:h-screen lg:overflow-hidden flex-col overflow-hidden items-center"
	style="background: radial-gradient(at center, var(--color-background) 50%, var(--color-surface) 90%)"
>
	<!-- Header -->
	<header class="relative max-w-420 mx-auto w-[96%] flex items-center justify-between shrink-0">
		<a href={resolve('/')} class="shrink-0">
			<img
				src="/feynman_circuits_logo_dark.svg"
				alt="Feynman Circuits Logo"
				class="logo-light h-16 sm:h-20 w-auto cursor-pointer"
			/>
			<img
				src="/feynman_circuits_logo.svg"
				alt="Feynman Circuits Logo"
				class="logo-dark h-16 sm:h-20 w-auto cursor-pointer"
			/>
		</a>

		<div class="hidden sm:flex flex-row">
			<h1 class="mb-2 text-xl font-semibold text-secondary-2">FEYNMAN</h1>
			<span class="mb-2 text-xl font-semibold" style="color: var(--color-text);">CIRCUITS</span>
		</div>

		<!-- The circuit name and save status now live on the board itself
		     (WireDropeZone), centred between its two button clusters, so they show
		     at phone widths too — this header copy was hidden below `sm`. -->
		<div class="flex items-center gap-2">
			<button
				on:click={toggleQecMode}
				aria-pressed={$qecMode}
				aria-label="Toggle QEC mode"
				title={$qecMode
					? 'QEC mode is on — only Clifford gates are available'
					: 'QEC mode — restricts the palette to Clifford gates'}
				class="shrink-0 flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors"
				style={$qecMode
					? 'color: #ffffff; background: var(--color-ternary-1); border-color: var(--color-ternary-1)'
					: 'color: var(--color-text); background: var(--color-surface); border-color: var(--color-border)'}
			>
				<Icon icon="ph:shield-check-bold" width="14" height="14" />
				QEC
			</button>

			<button
				on:click={openWelcome}
				aria-label="Open the guided tour"
				data-tour="help"
				class="shrink-0 p-2 rounded-full cursor-pointer transition-colors"
			>
				<Icon icon="ph:question-bold" width="22" height="22" style="color: var(--color-text)" />
			</button>

			<button
				on:click={toggleTheme}
				aria-label="Toggle theme"
				class="shrink-0 p-2 rounded-full cursor-pointer transition-colors"
			>
				<Icon
					icon={$resolvedTheme === 'dark' ? 'ph:sun-bold' : 'ph:moon-bold'}
					width="22"
					height="22"
					style="color: var(--color-text)"
				/>
			</button>

			<div class="shrink-0">
				<SignUp_In />
			</div>
		</div>
	</header>

	<!-- Gate Palette — always full-width across the top, in both dock modes -->
	<GatePalette />

	{#snippet mainContent()}
		<!-- Circuit board — fills all remaining vertical space -->
		<div
			bind:this={boardEl}
			data-tour="board"
			class="shadow-sm rounded-sm shadow-ternary-1 bg-ternary-3/20 min-h-[55vh] lg:flex-1 lg:min-h-0 overflow-hidden {contentWidth}"
		>
			<CircuitLayout />
		</div>
		{#if isWideScreen}
			<!-- Drag handle: resize the results row; persists on release -->
			<div
				role="slider"
				aria-label="Resize results row"
				aria-orientation="vertical"
				aria-valuemin={MIN_RESULTS}
				aria-valuemax={Math.round(vMaxHeight === Number.POSITIVE_INFINITY ? 1200 : vMaxHeight)}
				aria-valuenow={Math.round(resultsHeight)}
				tabindex="0"
				class="group flex h-2.5 shrink-0 cursor-row-resize items-center justify-center {contentWidth} {vDragging
					? 'select-none'
					: ''}"
				on:pointerdown={startVDrag}
				on:pointermove={onVDrag}
				on:pointerup={endVDrag}
				on:pointercancel={endVDrag}
				on:keydown={onVHandleKey}
			>
				<span
					class="h-1 w-10 rounded-full bg-secondary-2/40 transition-colors group-hover:bg-secondary-2 {vDragging
						? 'bg-secondary-2'
						: ''}"
				></span>
			</div>
		{/if}
		<!--
			Results row layout:
			  • < 640px (mobile): single column — only SimulationResult shows.
			  • 640–1024px: SimulationResult + BlochSphere share the top row, with
			    CircuitDataPanel full-width beneath them (dense-flow 2-col grid).
			  • ≥ 1024px, code docked bottom: all three side-by-side.
			  • ≥ 1024px, code docked left: the code panel lives in the left
			    column, so this grid only holds Sim (+ Bloch).
			Row height fixed at 20.625rem so nothing shifts.
		-->
		<!--
			`grid-auto-rows` is driven inline only on wide screens, where the drag
			handle exists and the board can give up the space. Below 1024px the
			inline style is omitted so the `sm:auto-rows-[20.625rem]` class stands.
		-->
		<div
			class="{contentWidth} {isWideScreen
				? 'mt-1'
				: 'mt-2.5'} mb-1 grid grid-cols-1 sm:grid-cols-2 sm:grid-flow-row-dense sm:auto-rows-[20.625rem] gap-2.5 shrink-0 {resultsGridCols}"
			style={isWideScreen
				? `grid-auto-rows: clamp(${MIN_RESULTS}px, ${resultsHeight}px, 60vh)`
				: ''}
		>
			<div
				data-tour="results"
				class="shadow-sm shadow-secondary-2 bg-secondary-3/20 rounded-sm p-4 overflow-y-auto min-w-0 min-h-0 {simSpan}"
			>
				<SimulationResult />
			</div>
			{#if !$isMobile && !leftMode}
				<div
					data-tour="code"
					class="sm:col-span-2 lg:col-span-1 shadow-sm shadow-secondary-2 bg-secondary-3/20 rounded-sm p-4 overflow-hidden min-w-0 min-h-0"
				>
					<CircuitDataPanel />
				</div>
			{/if}
			{#if showBloch}
				<Tooltip
					quick="Bloch Sphere"
					detail="Each qubit's state reduces to a vector r = (⟨X⟩, ⟨Y⟩, ⟨Z⟩): the north pole is |0⟩, the south pole is |1⟩, and the equator is superposition. This sphere plots the average of those vectors across the register, so it is exact for one qubit and only a summary for more — |01⟩ and a Bell pair both average to the centre. |r| = 1 means a pure state; |r| < 1 means mixed, which for a single qubit signals entanglement with the others."
				>
					<div
						class="w-full h-full shadow-sm shadow-secondary-2 bg-secondary-3/20 rounded-sm p-4 overflow-hidden flex justify-center"
					>
						<OverallBlochSphere />
					</div>
				</Tooltip>
			{/if}
		</div>
	{/snippet}

	<!--
		Left-dock layout. The wrappers use `display: contents` in bottom mode so
		they're layout-transparent (mainContent behaves as a direct child of
		<main>, exactly like before). In left mode they become a flex row: a tall
		code aside + a right column holding mainContent. Because mainContent stays
		in the same DOM position (inside the right wrapper) in both modes, toggling
		the dock only remounts the code panel — the circuit board is untouched.
	-->
	<div
		bind:this={splitRowEl}
		class={leftMode
			? `w-[96%] max-w-420 mx-auto flex-1 min-h-0 flex flex-row items-stretch ${dragging ? 'select-none' : ''}`
			: 'contents'}
	>
		{#if leftMode}
			<aside
				data-tour="code"
				class="shrink-0 flex flex-col min-h-0 shadow-sm shadow-secondary-2 bg-secondary-3/20 rounded-sm p-4 overflow-hidden"
				style="width: clamp({MIN_LEFT}px, {codePanelWidth}px, 65%)"
			>
				<CircuitDataPanel />
			</aside>
			<!-- Drag handle: resize the code panel; persists on release -->
			<div
				role="slider"
				aria-label="Resize code panel"
				aria-valuemin={MIN_LEFT}
				aria-valuemax={1200}
				aria-valuenow={Math.round(codePanelWidth)}
				tabindex="0"
				class="group mx-1 flex w-2 shrink-0 cursor-col-resize items-center justify-center self-stretch"
				on:pointerdown={startDrag}
				on:pointermove={onDrag}
				on:pointerup={endDrag}
				on:pointercancel={endDrag}
				on:keydown={onHandleKey}
			>
				<span
					class="h-10 w-1 rounded-full bg-secondary-2/40 transition-colors group-hover:bg-secondary-2 {dragging
						? 'bg-secondary-2'
						: ''}"
				></span>
			</div>
		{/if}
		<div class={leftMode ? 'flex-1 min-w-0 min-h-0 flex flex-col items-center' : 'contents'}>
			{@render mainContent()}
		</div>
	</div>

	<!-- Feedback link — subtle, at the very bottom centre -->
	<button
		type="button"
		on:click={() => (feedbackOpen = true)}
		class="mb-1.5 flex shrink-0 items-center gap-1 text-xs cursor-pointer transition-colors"
		style="color: var(--color-muted);"
		aria-label="Open feedback form"
	>
		<Icon icon="ph:chat-circle-text-bold" class="text-green-600" width="13" height="13" />
		<span class="underline underline-offset-2 font-bold text-green-600">Feedback</span>
	</button>
</main>

<OnboardingHost />

<HandoffDialog
	handoff={pendingHandoff}
	error={handoffError}
	onConfirm={acceptHandoff}
	onCancel={dismissHandoff}
/>

{#if feedbackOpen}
	<FeedbackModal onClose={() => (feedbackOpen = false)} />
{/if}

{#if $notification}
	<div
		class="fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-sm shadow-lg z-300 text-sm flex items-center gap-2 text-white {$notification.type ===
		'success'
			? 'bg-green-500'
			: 'bg-red-500'}"
	>
		<Icon
			icon={$notification.type === 'success'
				? 'material-symbols:check-circle'
				: 'material-symbols:error'}
			width="18"
			height="18"
		/>
		{$notification.message}
	</div>
{/if}
