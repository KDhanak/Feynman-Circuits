<script lang="ts">
	import { D3_LAYOUT, LATTICE_EXTENT } from '$lib/qec/layout';
	import { currentSnapshot, highlightedCheck, qecRunning, visibleLayers } from '$lib/qec/stores';
	import { createEventDispatcher } from 'svelte';
	import type { Check, InjectedError } from '$lib/qec/schema';

	// The counts are worked out from the layout instead of typed in, so the caption
	// can never disagree with the layout it describes. While this panel only gives
	// guidance, this is its main message: one logical qubit is not free, and this
	// is what it costs.
	const DATA_COUNT = D3_LAYOUT.dataQubits.length;
	const CHECK_COUNT = D3_LAYOUT.checks.length;

	// Grid units -> pixels. The layout grid goes from 0 to 6 on both axes. The viewBox
	// is worked out from the layout instead of typed in, so it stays correct if the
	// grid size ever changes (d=5 would go from 0 to 10).
	const CELL = 44;
	const PAD = 30;
	const px = (c: number) => PAD + c * CELL;
	const W = PAD * 2 + (LATTICE_EXTENT.maxX - LATTICE_EXTENT.minX) * CELL;
	const H = PAD * 2 + (LATTICE_EXTENT.maxY - LATTICE_EXTENT.minY) * CELL;

	const DATA_R = 9;

	// When true, data qubits can be clicked to place errors. The panel only
	// reports the click. What a click means is decided outside, in actions.ts.
	export let interactive = false;

	// Errors placed but not run yet. They are shown only while there is no
	// result, in a hollow "planned" style, so they can never be mistaken for the
	// truth layer of a run that really happened.
	export let planned: InjectedError[] = [];

	const dispatch = createEventDispatcher<{ qubitclick: { qubit: number } }>();

	function qubitLabel(id: number): string {
		return `Data qubit ${id}. Click to place or remove an error.`;
	}

	/**
	 * Plaquette outline. Weight-4 checks are drawn as the square through their four
	 * data qubits. Weight-2 boundary checks are drawn as a half-moon shape that
	 * bulges out to where the ancilla sits. This is the usual surface code picture,
	 * and it makes the edge of the code easy to see.
	 */
	function plaquettePath(check: Check): string {
		const pts = check.dataQubits
			.map((id) => D3_LAYOUT.dataQubits.find((q) => q.id === id))
			.filter((q): q is NonNullable<typeof q> => q != null)
			.map((q) => ({ x: px(q.x), y: px(q.y) }));
		if (pts.length < 2) return '';

		if (pts.length === 2) {
			const [a, b] = pts;
			const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
			const c = { x: px(check.x), y: px(check.y) };
			// The curve's control point is placed twice as far out as the ancilla, so the
			// tip of the curve lands right on the ancilla.
			const ctrl = { x: mid.x + (c.x - mid.x) * 2, y: mid.y + (c.y - mid.y) * 2 };
			return `M ${a.x} ${a.y} Q ${ctrl.x} ${ctrl.y} ${b.x} ${b.y} Z`;
		}

		const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
		const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
		const ordered = [...pts].sort(
			(p, q) => Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx)
		);
		return `M ${ordered.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`;
	}

	const plaquettes = D3_LAYOUT.checks.map((c) => ({ check: c, d: plaquettePath(c) }));

	// ── Layer 2: which checks fired this round ────────────────────────────
	$: events = $currentSnapshot?.measured.detectionEvents ?? {};
	$: firedChecks = new Set(
		$visibleLayers.measured ? Object.keys(events).filter((id) => events[id] === 1) : []
	);

	// ── Layer 1: what was actually injected ───────────────────────────────
	// Adds up over time, so a mark stays on the qubit once placed. The round it was
	// placed in is kept for the label, because "when" is half of the information.
	// Before a run there is no snapshot, so the marks come from the planned
	// errors instead. After a run they come only from the result.
	$: isPlanned = !$currentSnapshot;
	$: injected = isPlanned
		? planned
		: $visibleLayers.truth
			? ($currentSnapshot?.truth.injected ?? [])
			: [];
	$: injectedByQubit = injected.reduce<Record<number, { pauli: string; round: number }[]>>(
		(acc, e) => {
			(acc[e.qubit] ??= []).push({ pauli: e.pauli, round: e.round });
			return acc;
		},
		{}
	);

	function checkLabel(c: Check): string {
		const kind = c.type === 'X' ? 'X-type' : 'Z-type';
		return `${c.id}, ${kind} stabiliser on data qubits ${c.dataQubits.join(', ')}`;
	}
</script>

<div class="flex h-full w-full items-stretch gap-4">
	<!-- Everything that explains the picture sits beside it rather than under it.
	     The lattice is square, so the space to its left was empty anyway, and
	     moving the text there gives the lattice the full height of the panel.
	     The column is wide enough for "detection event (measured)" on two
	     comfortable lines rather than three squeezed ones. -->
	<aside class="flex w-60 shrink-0 flex-col justify-center gap-6 text-muted">
		<!-- Count caption. Always shown, because the numbers ARE the lesson: nine
		     data qubits plus eight ancillas give you just one protected qubit.
		     Laid out as a sum, with the operators in their own column and the
		     numbers right-aligned under each other, so it reads as arithmetic
		     rather than as four separate lines of text. -->
		<!-- justify-start keeps the three columns at content width; without it the
		     spare width in the panel is handed to them and the numbers drift away
		     from their operators. -->
		<div
			class="grid grid-cols-[0.85rem_auto_auto] items-baseline justify-start gap-x-2 gap-y-2 text-sm"
		>
			<span></span>
			<span class="text-right font-semibold" style="color: var(--color-text)">{DATA_COUNT}</span>
			<span>data</span>

			<span class="opacity-50">+</span>
			<span class="text-right font-semibold" style="color: var(--color-text)">{CHECK_COUNT}</span>
			<span>ancilla</span>

			<!-- The rule turns the two lines above into a sum, which is the point:
			     seventeen physical qubits go in, one protected qubit comes out. -->
			<span class="col-span-3 h-px" style="background: var(--color-border)"></span>

			<span class="opacity-50">=</span>
			<span class="text-right font-semibold" style="color: var(--color-text)"
				>{DATA_COUNT + CHECK_COUNT}</span
			>
			<span>physical</span>

			<span class="opacity-50">&rarr;</span>
			<span class="text-right font-semibold" style="color: var(--color-text)">1</span>
			<span style="color: var(--color-text)">logical qubit</span>
		</div>

		<!-- Legend. Shown from the start, even when only some layers have data:
		     the difference between the three layers is what we are teaching, so it
		     is labelled before there is anything in it. -->
		<div class="flex flex-col gap-2.5 text-xs leading-snug">
			<span class="flex items-start gap-1.5">
				<span
					class="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
					style="background: var(--color-measured)"
				></span>
				<span>injected error <span class="opacity-60">(truth)</span></span>
			</span>
			{#if isPlanned && planned.length}
				<span class="flex items-start gap-1.5">
					<span
						class="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-dashed"
						style="border-color: var(--color-measured)"
					></span>
					<span>placed, not run yet</span>
				</span>
			{/if}
			<span class="flex items-start gap-1.5">
				<span
					class="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full border"
					style="border-color: var(--color-check-z); background: var(--color-check-z)"
				></span>
				<span>detection event <span class="opacity-60">(measured)</span></span>
			</span>
			<span class="flex items-start gap-1.5">
				<span
					class="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full border"
					style="border-color: var(--color-check-x)"
				></span>
				<span>X-check</span>
			</span>
			<span class="flex items-start gap-1.5">
				<span
					class="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full border"
					style="border-color: var(--color-check-z)"
				></span>
				<span>Z-check</span>
			</span>
		</div>
	</aside>

	<!-- The lattice and whatever the panel puts under it share this column, so a
	     step control below lines up with the lattice rather than with the panel
	     as a whole (which would sit off to the left of it). -->
	<div class="flex min-w-0 flex-1 flex-col gap-1">
		<svg
			viewBox="0 0 {W} {H}"
			class="min-h-0 w-full flex-1"
			role="group"
			aria-label="Distance-3 rotated surface code lattice"
			aria-busy={$qecRunning}
		>
			<!-- Plaquettes first so data qubits and marks sit on top of them. -->
			{#each plaquettes as { check, d }, i (check.id)}
				{@const isFired = firedChecks.has(check.id)}
				<!-- Dimmed when a different check is highlighted, so hovering clearly means
			     "this one" and not "one of these". -->
				{@const isDim = $highlightedCheck !== null && $highlightedCheck !== check.id}
				<g
					role="button"
					tabindex="0"
					aria-label={checkLabel(check)}
					class="cursor-pointer outline-none"
					class:sweeping={$qecRunning}
					style="--sweep-i: {i}"
					on:mouseenter={() => highlightedCheck.set(check.id)}
					on:mouseleave={() => highlightedCheck.set(null)}
					on:focus={() => highlightedCheck.set(check.id)}
					on:blur={() => highlightedCheck.set(null)}
				>
					<!-- Outline only. The fill is transparent rather than "none" so the whole
				     plaquette, not just its border, still picks up the hover. A fired check
				     shows through its ancilla dot and a slightly heavier outline. -->
					<path
						{d}
						class="transition-opacity duration-150"
						fill="transparent"
						stroke={check.type === 'X' ? 'var(--color-check-x)' : 'var(--color-check-z)'}
						stroke-width={$highlightedCheck === check.id ? 2.5 : isFired ? 2 : 1.25}
						opacity={isDim ? 0.35 : 1}
					/>
					<!-- Ancilla marker: a detection event is shown as a filled ring, not only a
				     colour change, so it is still clear when printed or for colour-blind users. -->
					<circle
						cx={px(check.x)}
						cy={px(check.y)}
						r={isFired ? 6.5 : 3.5}
						fill={isFired
							? check.type === 'X'
								? 'var(--color-check-x)'
								: 'var(--color-check-z)'
							: 'var(--color-surface)'}
						stroke={check.type === 'X' ? 'var(--color-check-x)' : 'var(--color-check-z)'}
						stroke-width="1.5"
						opacity={isDim ? 0.35 : 1}
					/>
					<text
						x={px(check.x)}
						y={px(check.y) - 11}
						text-anchor="middle"
						class="pointer-events-none select-none text-[9px] font-semibold"
						fill="var(--color-muted)"
						opacity={isDim ? 0.35 : 0.85}>{check.id}</text
					>
				</g>
			{/each}

			<!-- Data qubits -->
			{#each D3_LAYOUT.dataQubits as q (q.id)}
				{@const hits = injectedByQubit[q.id] ?? []}
				<g>
					<circle
						cx={px(q.x)}
						cy={px(q.y)}
						r={DATA_R}
						fill="var(--color-surface)"
						stroke="var(--color-line)"
						stroke-width="1.5"
					/>
					<text
						x={px(q.x)}
						y={px(q.y) + 3.5}
						text-anchor="middle"
						class="pointer-events-none select-none text-[10px]"
						fill="var(--color-text)">{q.id}</text
					>
					{#if hits.length}
						<!-- Layer 1 mark: on purpose, a different shape and colour from
					     anything the syndrome or decoder layers draw. A planned error
					     (not run yet) is hollow and dashed. A real one is solid. -->
						<circle
							cx={px(q.x) + DATA_R}
							cy={px(q.y) - DATA_R}
							r="7"
							class="pointer-events-none"
							fill={isPlanned ? 'var(--color-surface)' : 'var(--color-measured)'}
							stroke={isPlanned ? 'var(--color-measured)' : 'var(--color-surface)'}
							stroke-width="1.5"
							stroke-dasharray={isPlanned ? '2 1.5' : undefined}
						/>
						<text
							x={px(q.x) + DATA_R}
							y={px(q.y) - DATA_R + 3}
							text-anchor="middle"
							class="pointer-events-none select-none text-[8px] font-bold"
							fill={isPlanned ? 'var(--color-measured)' : '#ffffff'}
							>{hits.map((h) => h.pauli).join('')}</text
						>
					{/if}
					{#if interactive}
						<!-- Click target. Drawn last so it sits on top, and a little larger
					     than the qubit so it is easy to hit. -->
						<circle
							cx={px(q.x)}
							cy={px(q.y)}
							r={DATA_R + 4}
							role="button"
							tabindex="0"
							aria-label={qubitLabel(q.id)}
							class="cursor-pointer fill-transparent stroke-transparent outline-none hover:fill-qec-1/15 focus-visible:stroke-qec-1"
							stroke-width="2"
							on:click={() => dispatch('qubitclick', { qubit: q.id })}
							on:keydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									dispatch('qubitclick', { qubit: q.id });
								}
							}}
						/>
					{/if}
				</g>
			{/each}
		</svg>

		<!-- Whatever the panel wants directly under the lattice: the step control,
		     or the one-line hint before a run. -->
		<slot />
	</div>
</div>

<style>
	/* Waiting for a run is shown on the lattice itself instead of over it: the
	   checks light up one after another, in the order the ancillas are measured.
	   The wait then teaches the thing the panel is for, and when the result
	   arrives the first step simply takes over from the sweep. The delay per
	   check comes from its position in the layout, so the order can never drift
	   away from the order the backend measures in. */
	.sweeping {
		animation: qec-sweep 1.2s linear infinite;
		animation-delay: calc(var(--sweep-i) * 0.09s);
	}

	/* The resting level stays readable on purpose. A check that is waiting its
	   turn is still part of the picture, so it dims rather than disappears. */
	@keyframes qec-sweep {
		0% {
			opacity: 0.4;
		}
		10% {
			opacity: 1;
		}
		32% {
			opacity: 0.4;
		}
		100% {
			opacity: 0.4;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sweeping {
			animation: none;
			opacity: 0.55;
		}
	}
</style>
