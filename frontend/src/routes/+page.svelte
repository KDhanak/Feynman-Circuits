<script lang="ts">
	import GatePalette from '../components/GatePalette.svelte';
	import SimulationResult from '../components/SimulationResult.svelte';
	import SignUp_In from '../components/SidePanel/AuthPanel.svelte';
	import { onMount } from 'svelte';
	import { loadSession } from '$lib/auth/session';
	import { resolvedTheme, toggleTheme } from '$lib/stores/themeStore';
	import { settings, updateSettings } from '$lib/stores/settingsStore';
	import { isMobile } from '$lib/stores/isMobile';
	import OverallBlochSphere from '../components/BlochSphere/OverallBlochSphere.svelte';
	import CircuitLayout from '../components/CircuitLayout/CircuitLayout.svelte';
	import CircuitDataPanel from '../components/CircuitDataPanel.svelte';
	import Icon from '@iconify/svelte';
	import { currentCircuitId, currentCircuitName } from '$lib/IR/stores';
	import { session } from '$lib/auth/session';
	import { saveStatus, notification } from '$lib/stores/uiStores';
	import '$lib/circuit/autoSave';
	import { get } from 'svelte/store';
	import FeedbackModal from '../components/FeedbackModal.svelte';
	import Tooltip from '../components/Tooltip.svelte';

	let feedbackOpen = false;

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

	// Only initialize on first load — stores survive HMR so skip re-init
	if (!get(currentCircuitId)) {
		currentCircuitId.set(crypto.randomUUID());
		currentCircuitName.set('Untitled Circuit');
	}

	onMount(() => {
		loadSession();
	});
</script>

<main
	class="flex pb-20 sm:pb-0 min-h-screen lg:h-screen lg:overflow-hidden flex-col overflow-hidden items-center"
	style="background: radial-gradient(at center, var(--color-background) 50%, var(--color-surface) 90%)"
>
	<!-- Header -->
	<header class="relative max-w-420 mx-auto w-[96%] flex items-center justify-between shrink-0">
		<a href="/" class="shrink-0">
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

		<div class="flex items-center gap-2">
			<div
				class="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-sm"
				class:invisible={$session.status !== 'authenticated'}
				style="color: var(--color-muted);"
			>
				<Icon icon="ph:circuit-board" width="15" height="15" />
				<span class="w-3.25 h-3.25 shrink-0 flex items-center justify-center">
					{#if $saveStatus === 'saving'}
						<Icon
							icon="svg-spinners:ring-resize"
							width="13"
							height="13"
							style="color: var(--color-measured);"
						/>
					{:else if $saveStatus === 'saved'}
						<Icon icon="ph:check-bold" width="13" height="13" class="text-green-500" />
					{/if}
				</span>
				<span class="text-sm font-semibold max-w-40 truncate">{$currentCircuitName}</span>
			</div>

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
			class="shadow-sm rounded-sm shadow-ternary-1 bg-ternary-3/20 min-h-[55vh] lg:flex-1 lg:min-h-0 overflow-hidden {contentWidth}"
		>
			<CircuitLayout />
		</div>
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
		<div
			class="{contentWidth} mt-2.5 mb-1 grid grid-cols-1 sm:grid-cols-2 sm:grid-flow-row-dense sm:auto-rows-[20.625rem] gap-2.5 shrink-0 {resultsGridCols}"
		>
			<div
				class="shadow-sm shadow-secondary-2 bg-secondary-3/20 rounded-sm p-4 overflow-y-auto min-w-0 min-h-0 {simSpan}"
			>
				<SimulationResult />
			</div>
			{#if !$isMobile && !leftMode}
				<div
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
