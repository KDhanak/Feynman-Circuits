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
	import QecPanel from '../components/Qec/QecPanel.svelte';
	import CircuitLayout from '../components/CircuitLayout/CircuitLayout.svelte';
	import CircuitDataPanel from '../components/CircuitDataPanel.svelte';
	import Icon from '@iconify/svelte';
	import { currentCircuitId, currentCircuitName } from '$lib/IR/stores';
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

	// Grip dots for the two resize handles. Three dots is the usual grip sign, and
	// at this small size it looks "draggable", while a bar would just look like a divider.
	const GRIP_DOTS = [0, 1, 2];

	// Panel explanations. Kept here instead of in the HTML because they are long and
	// have apostrophes, which HTML attributes in the template handle badly.
	const BLOCH_TIP = `Each qubit's state reduces to a vector r = (⟨X⟩, ⟨Y⟩, ⟨Z⟩): the north pole is |0⟩, the south pole is |1⟩, and the equator is superposition. This sphere plots the average of those vectors across the register, so it is exact for one qubit and only a summary for more — |01⟩ and a Bell pair both average to the centre. |r| = 1 means a pure state; |r| < 1 means mixed, which for a single qubit signals entanglement with the others.`;

	const QEC_TIP = `A rotated distance-3 surface code: nine data qubits hold ONE logical qubit, and eight ancillas keep checking the stabilisers around them, never the data itself, which would destroy the state. Click a data qubit to place an error, press Run, then step through the rounds to see which checks notice it and whether the decoder gets it right. Your circuit above is not encoded into this code: this is a separate experiment on one protected qubit.`;

	// The Bloch sphere is optional. When it's hidden, the results row changes its
	// layout so SimulationResult grows into the space the sphere would have used.
	$: showBloch = $settings.showBlochSphere && !$isMobile;

	// The results panel is optional too. Hiding it gives its space to the board.
	$: showSim = $settings.showSimulationResults;

	// QEC mode takes over the results row. The simulation results and the third
	// panel both show a state vector, which is not what QEC mode is about, so they
	// give their space to one wide surface code panel. That panel needs the width,
	// because it will later draw the syndrome history. Not used on mobile, where
	// the row is already a single narrow column.
	$: qecTakeover = $qecMode && !$isMobile;

	// The code panel can be moved to a tall left column, but only when the screen is
	// wide enough (≥1024px). On smaller screens it stays at the bottom.
	let isWideScreen = false;
	onMount(() => {
		const mq = window.matchMedia('(min-width: 1024px)');
		isWideScreen = mq.matches;
		const handler = (e: MediaQueryListEvent) => (isWideScreen = e.matches);
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	});
	$: leftMode = $settings.codePanelPosition === 'left' && isWideScreen;

	// Which panels are in the results row. In QEC mode the QEC panel replaces
	// Sim and Bloch. The code panel is only here when it is docked at the bottom.
	$: rowHasSim = showSim && !qecTakeover;
	$: rowHasBloch = showBloch && !qecTakeover;
	$: rowHasCode = !$isMobile && !leftMode;
	// With every panel turned off, the row is left out, along with its drag handle,
	// and the board takes the whole height.
	$: resultsRowEmpty = !rowHasSim && !rowHasBloch && !rowHasCode && !qecTakeover;

	// Column layout for the results grid at ≥1024px. Each case is written out in
	// full because Tailwind only builds classes it can find whole in the source.
	// When the code panel is on the left it is not in this grid, so Sim and Bloch
	// share the narrower right column. In QEC mode the code panel and the QEC
	// panel share the row.
	$: resultsGridCols = leftMode
		? rowHasSim && rowHasBloch
			? 'lg:grid-cols-2'
			: 'lg:grid-cols-1'
		: qecTakeover
			? 'lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]'
			: rowHasSim && rowHasBloch
				? 'lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)_auto]'
				: rowHasSim
					? 'lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]'
					: rowHasBloch
						? 'lg:grid-cols-[minmax(0,1fr)_auto]'
						: 'lg:grid-cols-1';
	// Between 640 and 1024px the row is 2 columns, with Sim and Bloch side by side.
	// When one of the two is hidden, the other takes the full width. Not needed
	// when the code panel is on the left (Sim already fills its column there).
	$: simSpan = !leftMode && !showBloch ? 'sm:col-span-2 lg:col-span-1' : '';
	$: blochSpan = !rowHasSim ? 'sm:col-span-2 lg:col-span-1' : '';

	// In bottom mode the board/results are 96% wide and centred, like the palette.
	// In left mode they fill the right column so their right edge lines up with
	// the palette above (the column itself is already 96%-aligned).
	$: contentWidth = leftMode ? 'w-full' : 'w-[96%] max-w-420 mx-auto';

	// ── Draggable divider for the left-docked code panel ─────────────────
	// `codePanelWidth` is the wanted width in px. The style keeps it between
	// 280px and 65%, so the right column always has room. Saved when the drag ends.
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
	// Only works at ≥1024px, where <main> is h-screen and the board is `lg:flex-1
	// lg:min-h-0`, so making the results row smaller gives that space straight back
	// to the board. On smaller screens the page scrolls and the row keeps its CSS height.
	let boardEl: HTMLDivElement | undefined;
	let vDragging = false;
	let resultsHeight = get(settings).resultsRowHeightPx;
	const MIN_RESULTS = 160;
	const MIN_BOARD = 220;
	// Measured at pointerdown: board + results stays the same size during a drag, so
	// the maximum can be set once at the start, instead of measuring again while things move.
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
		// Moving it with the keyboard skips pointerdown, so set the maximum here too.
		vMaxHeight = boardEl ? resultsHeight + boardEl.clientHeight - MIN_BOARD : 1200;
		if (e.key === 'ArrowUp') resultsHeight = clampHeight(resultsHeight + STEP);
		else if (e.key === 'ArrowDown') resultsHeight = clampHeight(resultsHeight - STEP);
		else return;
		e.preventDefault();
		updateSettings({ resultsRowHeightPx: Math.round(resultsHeight) });
	}

	// Only set up on first load. Stores are kept during hot reload (HMR), so don't set them up again
	if (!get(currentCircuitId)) {
		currentCircuitId.set(crypto.randomUUID());
		currentCircuitName.set('Untitled Circuit');
	}

	// --- Shared-circuit links ------------------------------------------------
	// A share link can hold a circuit. We read it in the browser instead of in a
	// `+page.ts` load: the in-link kind is in the URL fragment (after #), which
	// never reaches the server, so a universal load could not see it anyway.
	let pendingHandoff: ResolvedHandoff | null = null;
	let handoffError: string | null = null;

	function acceptHandoff() {
		if (!pendingHandoff) return;
		const { ir, name, circuitId } = pendingHandoff;
		// A circuit made public from this app keeps its id, so the visitor can tell
		// it is the same circuit. Anything from elsewhere gets a new local id. Neither
		// is treated as already saved, because this visitor does not own it until they
		// save it themselves.
		applyCircuit(ir, { id: circuitId, name, saved: false });
		showNotification(`"${name}" loaded.`, 'success');
		dismissHandoff();
	}

	function dismissHandoff() {
		pendingHandoff = null;
		handoffError = null;
		// Remove the param so a refresh does not load the handoff again over the user's edits.
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
	style="background: var(--color-background)"
>
	<!-- Header -->
	<header class="relative max-w-420 mx-auto w-[96%] flex items-center justify-between shrink-0">
		<!-- One brand lockup on the left: the |Ψ⟩ mark plus the wordmark. The
		     wordmark used to sit centred as a second, separate piece of branding. -->
		<a href={resolve('/')} class="shrink-0 flex items-center gap-2.5 py-2">
			<img
				src="/feynman_circuits_logo_dark.svg"
				alt="Feynman Circuits Logo"
				class="logo-light h-12 sm:h-14 w-auto cursor-pointer"
			/>
			<img
				src="/feynman_circuits_logo.svg"
				alt="Feynman Circuits Logo"
				class="logo-dark h-12 sm:h-14 w-auto cursor-pointer"
			/>
			<span class="hidden sm:block h-6 w-px" style="background: var(--color-border-strong)"></span>
			<h1 class="hidden sm:block text-[15px] font-semibold tracking-tight leading-none">
				<span class="text-branding">Feynman</span><span style="color: var(--color-text);"
					>Circuits</span
				>
			</h1>
		</a>

		<!-- The circuit name and save status are now on the board itself
		     (WireDropeZone), centred between its two groups of buttons, so they show
		     on phones too. The copy that used to be in this header was hidden below `sm`. -->
		<!-- Header buttons. All three have the same height and corner radius, so the
		     row lines up. The account button has a line before it because it is about
		     who you are, not a tool, and should not look like just a third button. -->
		<div class="flex items-center gap-1">
			<button
				on:click={openWelcome}
				aria-label="Open the guided tour"
				data-tour="help"
				class="shrink-0 flex h-9 w-9 items-center justify-center rounded-sm cursor-pointer transition-colors hover:bg-text/5"
			>
				<Icon icon="ph:question-bold" width="20" height="20" style="color: var(--color-text)" />
			</button>

			<button
				on:click={toggleTheme}
				aria-label="Toggle theme"
				class="shrink-0 flex h-9 w-9 items-center justify-center rounded-sm cursor-pointer transition-colors hover:bg-text/5"
			>
				<Icon
					icon={$resolvedTheme === 'dark' ? 'ph:sun-bold' : 'ph:moon-bold'}
					width="20"
					height="20"
					style="color: var(--color-text)"
				/>
			</button>

			<span class="mx-1.5 h-5 w-px shrink-0" style="background: var(--color-border)"></span>

			<div class="shrink-0">
				<SignUp_In />
			</div>
		</div>
	</header>

	<!-- Gate Palette — always full-width across the top, in both dock modes -->
	<GatePalette />

	{#snippet mainContent()}
		<!-- Circuit board. Below `lg` it is a fixed 55vh tall, not a minimum. A
		     minimum let the panel grow as qubits were added, which moved the
		     circuit name and the undo/redo buttons at its bottom edge further down
		     the page with every wire. At a fixed height the wires scroll inside the
		     panel instead, so the bottom of the panel stays where it is. From `lg`
		     up the panel takes all the height the page has left, as before. When
		     nothing is shown below the board (results turned off on a phone), it
		     is still a fixed height, just a taller one, to use that space. It also
		     takes over the results row's bottom margin, so its bottom edge lines
		     up with the code panel when that is docked on the left. -->
		<div
			bind:this={boardEl}
			data-tour="board"
			class="panel flex {resultsRowEmpty
				? 'h-[72vh] mb-1'
				: 'h-[55vh]'} lg:h-auto lg:flex-1 lg:min-h-0 overflow-hidden {contentWidth}"
		>
			<CircuitLayout />
		</div>
		{#if isWideScreen && !resultsRowEmpty}
			<!-- Drag handle: resize the results row. Saved when you let go -->
			<div
				role="slider"
				aria-label="Resize results row"
				aria-orientation="vertical"
				aria-valuemin={MIN_RESULTS}
				aria-valuemax={Math.round(vMaxHeight === Number.POSITIVE_INFINITY ? 1200 : vMaxHeight)}
				aria-valuenow={Math.round(resultsHeight)}
				tabindex="0"
				class="group flex h-2 shrink-0 cursor-row-resize items-center justify-center {contentWidth} {vDragging
					? 'select-none'
					: ''}"
				on:pointerdown={startVDrag}
				on:pointermove={onVDrag}
				on:pointerup={endVDrag}
				on:pointercancel={endVDrag}
				on:keydown={onVHandleKey}
			>
				<span
					class="flex items-center gap-1 text-secondary-2/40 transition-colors group-hover:text-secondary-2 {vDragging
						? 'text-secondary-2'
						: ''}"
				>
					{#each GRIP_DOTS as i (i)}
						<span class="h-0.75 w-0.75 rounded-full bg-current"></span>
					{/each}
				</span>
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
			`grid-auto-rows` is only set inline on wide screens, where the drag
			handle exists and the board can give up the space. Below 1024px the
			inline style is left out, so the `sm:auto-rows-[20.625rem]` class is used.
		-->
		{#if !resultsRowEmpty}
			<div
				class="{contentWidth} {isWideScreen
					? 'mt-0'
					: 'mt-2'} mb-1 grid grid-cols-1 sm:grid-cols-2 sm:grid-flow-row-dense sm:auto-rows-[20.625rem] gap-2 shrink-0 {resultsGridCols}"
				style={isWideScreen
					? `grid-auto-rows: clamp(${MIN_RESULTS}px, ${resultsHeight}px, 60vh)`
					: ''}
			>
				{#if rowHasSim}
					<div data-tour="results" class="panel p-4 overflow-y-auto min-w-0 min-h-0 {simSpan}">
						<SimulationResult />
					</div>
				{/if}
				{#if rowHasCode}
					<div
						data-tour="code"
						class="sm:col-span-2 lg:col-span-1 panel p-4 overflow-hidden min-w-0 min-h-0"
					>
						<CircuitDataPanel />
					</div>
				{/if}
				{#if qecTakeover}
					<!--
					QEC mode: one wide panel that replaces both the simulation results
					and the third panel. It holds the whole QEC experiment:
					the lattice, the controls, the injection ledger and the step control.
					`sm:col-span-2` is needed below 1024px, where the row is a simple
					2-column grid and a single item would otherwise only fill half of it.
				-->
					<Tooltip
						class="sm:col-span-2 lg:col-span-1 min-w-0 min-h-0"
						quick="Surface Code (distance 3)"
						detail={QEC_TIP}
					>
						<div
							data-tour="results"
							class="w-full h-full panel p-4 overflow-hidden flex justify-center"
						>
							<QecPanel />
						</div>
					</Tooltip>
				{:else if showBloch}
					<Tooltip class={blochSpan} quick="Bloch Sphere" detail={BLOCH_TIP}>
						<div class="w-full h-full panel p-4 overflow-hidden flex justify-center">
							<OverallBlochSphere />
						</div>
					</Tooltip>
				{/if}
			</div>
		{/if}
	{/snippet}

	<!--
		Layout for the code panel on the left. In bottom mode the wrappers use
		`display: contents`, so they don't affect the layout (mainContent acts as a
		direct child of <main>, exactly like before). In left mode they become a flex
		row: a tall code panel plus a right column holding mainContent. Because
		mainContent stays in the same place in the DOM (inside the right wrapper) in
		both modes, switching modes only rebuilds the code panel. The circuit board
		is not touched.
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
				class="shrink-0 mb-1 flex flex-col min-h-0 panel p-4 overflow-hidden"
				style="width: clamp({MIN_LEFT}px, {codePanelWidth}px, 65%)"
			>
				<CircuitDataPanel />
			</aside>
			<!-- Drag handle: resize the code panel. Saved when you let go -->
			<div
				role="slider"
				aria-label="Resize code panel"
				aria-valuemin={MIN_LEFT}
				aria-valuemax={1200}
				aria-valuenow={Math.round(codePanelWidth)}
				tabindex="0"
				class="group flex w-2 shrink-0 cursor-col-resize items-center justify-center self-stretch"
				on:pointerdown={startDrag}
				on:pointermove={onDrag}
				on:pointerup={endDrag}
				on:pointercancel={endDrag}
				on:keydown={onHandleKey}
			>
				<span
					class="flex flex-col items-center gap-1 text-secondary-2/40 transition-colors group-hover:text-secondary-2 {dragging
						? 'text-secondary-2'
						: ''}"
				>
					{#each GRIP_DOTS as i (i)}
						<span class="h-0.75 w-0.75 rounded-full bg-current"></span>
					{/each}
				</span>
			</div>
		{/if}
		<div class={leftMode ? 'flex-1 min-w-0 min-h-0 flex flex-col items-center' : 'contents'}>
			{@render mainContent()}
		</div>
	</div>

	<!-- Feedback and Privacy links: small and quiet, at the very bottom centre.
	     Privacy opens in a new tab so the circuit on the board is not lost. -->
	<div class="mb-1.5 flex shrink-0 items-center gap-3 text-xs">
		<button
			type="button"
			on:click={() => (feedbackOpen = true)}
			class="flex items-center gap-1 cursor-pointer transition-colors"
			style="color: var(--color-muted);"
			aria-label="Open feedback form"
		>
			<Icon icon="ph:chat-circle-text-bold" width="13" height="13" />
			<span class="underline underline-offset-2">Feedback</span>
		</button>
		<a
			href={resolve('/privacy')}
			target="_blank"
			rel="noopener"
			class="underline underline-offset-2"
			style="color: var(--color-muted);">Privacy</a
		>
	</div>
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
		class="toast fixed top-4 left-1/2 -translate-x-1/2 px-3.5 py-2 rounded-md shadow-lg z-300 text-sm font-medium flex items-center gap-2 {$notification.type ===
		'success'
			? 'toast-success'
			: 'toast-error'}"
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
