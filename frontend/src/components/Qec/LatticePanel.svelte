<script lang="ts">
	import { D3_LAYOUT, LATTICE_EXTENT } from '$lib/qec/layout';
	import { currentSnapshot, highlightedCheck, visibleLayers } from '$lib/qec/stores';
	import type { Check } from '$lib/qec/schema';

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
	$: injected = $visibleLayers.truth ? ($currentSnapshot?.truth.injected ?? []) : [];
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

<div class="flex h-full w-full flex-col items-center justify-center gap-2">
	<svg
		viewBox="0 0 {W} {H}"
		class="max-h-full w-auto max-w-full"
		role="group"
		aria-label="Distance-3 rotated surface code lattice"
	>
		<!-- Plaquettes first so data qubits and marks sit on top of them. -->
		{#each plaquettes as { check, d } (check.id)}
			{@const isFired = firedChecks.has(check.id)}
			<!-- Dimmed when a different check is highlighted, so hovering clearly means
			     "this one" and not "one of these". -->
			{@const isDim = $highlightedCheck !== null && $highlightedCheck !== check.id}
			<g
				role="button"
				tabindex="0"
				aria-label={checkLabel(check)}
				class="cursor-pointer outline-none"
				on:mouseenter={() => highlightedCheck.set(check.id)}
				on:mouseleave={() => highlightedCheck.set(null)}
				on:focus={() => highlightedCheck.set(check.id)}
				on:blur={() => highlightedCheck.set(null)}
			>
				<path
					{d}
					class="transition-opacity duration-150"
					fill={check.type === 'X' ? 'var(--color-secondary-2)' : 'var(--color-ternary-1)'}
					fill-opacity={isFired ? 0.55 : 0.14}
					stroke={check.type === 'X' ? 'var(--color-secondary-2)' : 'var(--color-ternary-1)'}
					stroke-width={$highlightedCheck === check.id ? 2.5 : 1.25}
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
							? 'var(--color-secondary-2)'
							: 'var(--color-ternary-1)'
						: 'var(--color-surface)'}
					stroke={check.type === 'X' ? 'var(--color-secondary-2)' : 'var(--color-ternary-1)'}
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
					     anything the syndrome or decoder layers draw. -->
					<circle
						cx={px(q.x) + DATA_R}
						cy={px(q.y) - DATA_R}
						r="7"
						fill="var(--color-measured)"
						stroke="var(--color-surface)"
						stroke-width="1.5"
					/>
					<text
						x={px(q.x) + DATA_R}
						y={px(q.y) - DATA_R + 3}
						text-anchor="middle"
						class="pointer-events-none select-none text-[8px] font-bold"
						fill="#ffffff">{hits.map((h) => h.pauli).join('')}</text
					>
				{/if}
			</g>
		{/each}
	</svg>

	<!-- Count caption. Always shown, because the numbers ARE the lesson: nine data
	     qubits plus eight ancillas give you just one protected qubit. -->
	<p class="text-center text-[0.7rem] leading-tight text-muted">
		<span class="font-semibold" style="color: var(--color-text)">{DATA_COUNT}</span> data
		<span class="opacity-50">+</span>
		<span class="font-semibold" style="color: var(--color-text)">{CHECK_COUNT}</span> ancilla
		<span class="opacity-50">=</span>
		<span class="font-semibold" style="color: var(--color-text)"
			>{DATA_COUNT + CHECK_COUNT} physical</span
		>
		<span class="opacity-50">&rarr;</span>
		<span class="font-semibold" style="color: var(--color-text)">1 logical qubit</span>
	</p>

	<!-- Legend. Shown from the start, even when only some layers have data:
	     the difference between the three layers is what we are teaching, so it is
	     labelled before there is anything in it. -->
	<div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[0.7rem] text-muted">
		<span class="flex items-center gap-1.5">
			<span class="inline-block h-2.5 w-2.5 rounded-full" style="background: var(--color-measured)"
			></span>injected error <span class="opacity-60">(truth)</span>
		</span>
		<span class="flex items-center gap-1.5">
			<span
				class="inline-block h-2.5 w-2.5 rounded-full border"
				style="border-color: var(--color-ternary-1); background: var(--color-ternary-1)"
			></span>detection event <span class="opacity-60">(measured)</span>
		</span>
		<span class="flex items-center gap-1.5">
			<span
				class="inline-block h-2.5 w-2.5 rounded-full border"
				style="border-color: var(--color-secondary-2)"
			></span>X-check
			<span
				class="ml-2 inline-block h-2.5 w-2.5 rounded-full border"
				style="border-color: var(--color-ternary-1)"
			></span>Z-check
		</span>
	</div>
</div>
