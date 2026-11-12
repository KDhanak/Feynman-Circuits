<script lang="ts">
	// The calculation, one column at a time. For the chosen column it shows the
	// column as one operator, the state before and after it, and the matrix
	// multiplication that turns one into the other. All of it comes from the
	// record the simulator keeps while it runs (SimulationResult.steps), so it
	// is always the same run as the results.
	import { onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { simulationResult } from '$lib/IR/stores';
	import type { SimulationStep } from '$lib/IR/schema';
	import { settings } from '$lib/stores/settingsStore';
	import { selectedStepColumn } from '$lib/stores/uiStores';
	import { MAX_STEP_MATRIX_QUBITS } from '$lib/circuit/simulator';
	import {
		describeOperation,
		displayIndexOrder,
		displayQubitOrder,
		ketTerms,
		matrixText,
		operatorFactors,
		subscript,
		vectorText,
		basisLabel,
		type KetTerm,
		type OperatorFactor
	} from '$lib/circuit/steps';
	import MatrixView from './MatrixView.svelte';

	$: steps = $simulationResult.steps ?? [];
	$: bitOrder = $settings.bitOrder;

	// Which step is open. It is stored as a column (shared with the board, which
	// highlights it), so editing the circuit keeps you on the same column. If
	// that column is now empty, it moves to the nearest step before it.
	function pickIndex(list: SimulationStep[], column: number | null): number {
		if (list.length === 0) return -1;
		if (column === null) return 0;
		const exact = list.findIndex((s) => s.column === column);
		if (exact >= 0) return exact;
		let best = 0;
		list.forEach((s, k) => {
			if (s.column <= column) best = k;
		});
		return best;
	}
	$: index = pickIndex(steps, $selectedStepColumn);
	$: step = index >= 0 ? steps[index] : null;
	$: if (step && step.column !== $selectedStepColumn) selectedStepColumn.set(step.column);
	onDestroy(() => selectedStepColumn.set(null));

	function go(delta: number) {
		const next = steps[index + delta];
		if (next) selectedStepColumn.set(next.column);
	}

	$: n = step ? Math.log2(step.before.length) : 0;
	$: order = displayIndexOrder(n, bitOrder);
	$: wireOrder = displayQubitOrder(n, bitOrder)
		.map((q) => `q${q}`)
		.join(' ⊗ ');
	$: applied = step ? step.ops.filter((o) => !o.skipped) : [];
	$: psiIn = `ψ${subscript(index)}`;
	$: psiOut = `ψ${subscript(index + 1)}`;
	$: uName = `U${subscript(index + 1)}`;
	$: beforeTerms = step ? ketTerms(step.before, n, bitOrder, step.after) : [];
	$: afterTerms = step ? ketTerms(step.after, n, bitOrder, step.before) : [];
	$: rowLabels = order.map((i) => `|${basisLabel(i, n, bitOrder)}⟩`);
	// The entries of the "after" vector that the column changed.
	$: changedRows = new Set(
		step
			? order
					.map((i, r) => [i, r])
					.filter(
						([i]) =>
							Math.abs(step.before[i].re - step.after[i].re) > 1e-9 ||
							Math.abs(step.before[i].im - step.after[i].im) > 1e-9
					)
					.map(([, r]) => `${r},0`)
			: []
	);

	// The factors of the column's operator, and the one opened to show its
	// matrix. It is kept by key, so it stays open while the circuit is edited,
	// and closes by itself when that factor is no longer in the column.
	$: factors = step
		? operatorFactors(step.ops, n, bitOrder)
		: { tensor: [] as OperatorFactor[], products: [] as OperatorFactor[] };
	let openKey: string | null = null;
	$: openFactor = [...factors.tensor, ...factors.products].find((f) => f.key === openKey) ?? null;

	// The sign written before a term: none for a positive first term.
	const termSign = (t: KetTerm, k: number) => (k > 0 || t.sign === '−' ? ` ${t.sign} ` : '');

	const percent = (p: number) => `${(p * 100).toFixed($settings.probabilityDecimals)}%`;
</script>

{#snippet factorButton(f: OperatorFactor)}
	<button
		type="button"
		class="factor-btn"
		aria-pressed={openKey === f.key}
		title="Show the matrix of {f.label}"
		on:click={() => (openKey = openKey === f.key ? null : f.key)}>{f.label}</button
	>
{/snippet}

<div class="flex flex-col gap-3 px-1 pb-2 text-sm">
	{#if !step}
		<p class="text-center text-sm mt-6" style="color: var(--color-muted);">
			Add a gate to see the calculation, one column at a time.
		</p>
	{:else}
		<!-- Step picker -->
		<div class="flex items-center justify-center gap-3">
			<button
				type="button"
				class="step-btn"
				disabled={index === 0}
				on:click={() => go(-1)}
				aria-label="Previous column"
				title="Previous column"
			>
				<Icon icon="ph:caret-left-bold" width="16" height="16" />
			</button>
			<div class="text-center leading-tight">
				<p class="font-semibold">Column {step.column + 1}</p>
				<p class="text-xs" style="color: var(--color-muted);">
					Step {index + 1} of {steps.length}
				</p>
			</div>
			<button
				type="button"
				class="step-btn"
				disabled={index === steps.length - 1}
				on:click={() => go(1)}
				aria-label="Next column"
				title="Next column"
			>
				<Icon icon="ph:caret-right-bold" width="16" height="16" />
			</button>
		</div>

		<!-- The column as one operator -->
		{#if applied.length > 0}
			<div class="font-mono text-[13px] leading-relaxed">
				<p>|{psiOut}⟩ = {uName} |{psiIn}⟩</p>
				<!-- Each factor is a button that opens its own matrix below. -->
				<p class="flex flex-wrap items-center gap-x-1 gap-y-1">
					<span>{uName} =</span>
					{#if factors.tensor.length && factors.products.length}<span>(</span>{/if}
					{#each factors.tensor as f, k (f.key)}
						{#if k > 0}<span>⊗</span>{/if}
						{@render factorButton(f)}
					{/each}
					{#if factors.tensor.length && factors.products.length}<span>)</span>{/if}
					{#each factors.products as f, k (f.key)}
						{#if k > 0 || factors.tensor.length}<span>·</span>{/if}
						{@render factorButton(f)}
					{/each}
				</p>
				{#if n > 1}
					<p class="text-[11px]" style="color: var(--color-muted);">⊗ order: {wireOrder}</p>
				{/if}
				{#if !openFactor}
					<p class="text-[11px]" style="color: var(--color-muted);">
						Click a factor to see its matrix.
					</p>
				{/if}
			</div>

			{#if openFactor}
				{@const qs = openFactor.qubits.map((q) => `q${q}`).join(' ')}
				<div class="factor-panel text-xs">
					<div class="flex items-start justify-between gap-2">
						<p class="font-mono">
							<span class="font-semibold" style="color: var(--color-branding);"
								>{openFactor.label}</span
							>
							on {qs}{#if openFactor.note}<span style="color: var(--color-muted);"
									>, {openFactor.note}</span
								>{/if}
						</p>
						<button
							type="button"
							class="close-btn"
							on:click={() => (openKey = null)}
							aria-label="Close this matrix"
							title="Close"
						>
							<Icon icon="ph:x-bold" width="12" height="12" />
						</button>
					</div>
					{#if openFactor.matrix}
						{@const k = openFactor.qubits.length}
						{@const localOrder = displayIndexOrder(k, bitOrder)}
						<div class="mt-2 overflow-x-auto pb-1 font-mono">
							<MatrixView
								size="md"
								rows={matrixText(openFactor.matrix, localOrder)}
								rowLabels={localOrder.map((i) => `|${basisLabel(i, k, bitOrder)}⟩`)}
							/>
						</div>
						{#if k > 1}
							<p class="mt-1" style="color: var(--color-muted);">
								Rows and columns are the states of {qs}, written in that order. The other qubits are
								left as they are.
							</p>
						{/if}
					{:else}
						<p class="mt-1" style="color: var(--color-muted);">
							It acts on {openFactor.qubits.length} qubits, so its matrix is {1 <<
								openFactor.qubits.length}×{1 << openFactor.qubits.length}, too big to read here.
						</p>
					{/if}
				</div>
			{/if}
		{/if}

		<ul class="text-xs list-disc pl-4 space-y-0.5">
			{#each step.ops as { op, skipped } (op.id)}
				<li style={skipped ? 'color: var(--color-muted);' : ''}>
					{describeOperation(op)}{#if skipped}
						— skipped, q{op.targets[0]} was already measured{/if}
				</li>
			{/each}
			{#each step.measurements as m (m.qubit)}
				<li>Measure q{m.qubit}</li>
			{/each}
		</ul>

		<!-- State before and after -->
		<div class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 font-mono text-xs items-baseline">
			<span style="color: var(--color-muted);">before</span>
			<span class="wrap-break-word"
				>|{psiIn}⟩ =
				{#each beforeTerms as t, k (t.label)}
					<span class:changed={t.changed}>{termSign(t, k)}{t.coefficient}|{t.label}⟩</span>
				{/each}</span
			>
			<span style="color: var(--color-muted);">after</span>
			<span class="wrap-break-word"
				>|{psiOut}⟩ =
				{#each afterTerms as t, k (t.label)}
					<span class:changed={t.changed}>{termSign(t, k)}{t.coefficient}|{t.label}⟩</span>
				{/each}</span
			>
		</div>

		<!-- Measurement: Born's rule, then collapse -->
		{#each step.measurements as m (m.qubit)}
			<div
				class="rounded-sm border px-2.5 py-2 text-xs space-y-1"
				style="border-color: color-mix(in srgb, var(--color-measured) 50%, transparent);"
			>
				<p class="font-semibold" style="color: var(--color-measured);">
					Measuring q{m.qubit} is random, not a matrix multiplication
				</p>
				<p class="font-mono">
					P(0) = {percent(m.prob0)}, P(1) = {percent(1 - m.prob0)} → read
					<span class="font-semibold" style="color: var(--color-measured);">{m.outcome}</span>
				</p>
				<p class="font-mono">
					|ψ′⟩ = P{subscript(m.outcome)} |ψ⟩ / √P({m.outcome})
				</p>
				<p style="color: var(--color-muted);">
					Keep only the terms where q{m.qubit} = {m.outcome}, then rescale them so the probabilities
					add up to 1 again.
				</p>
			</div>
		{/each}

		<!-- The matrices -->
		{#if step.matrix}
			<details open class="text-xs">
				<summary class="cursor-pointer select-none font-medium">
					Full matrix ({step.matrix.length}×{step.matrix.length}): {uName} · |{psiIn}⟩ = |{psiOut}⟩
				</summary>
				<div class="mt-2 overflow-x-auto pb-1">
					<!-- In a narrow panel the vectors wrap below the matrix instead of
					     going off the edge, so the result always stays in view. -->
					<div class="flex flex-wrap items-center gap-2 font-mono">
						<MatrixView size="md" rows={matrixText(step.matrix, order)} {rowLabels} />
						<MatrixView size="md" rows={vectorText(step.before, order)} />
						<span>=</span>
						<MatrixView size="md" rows={vectorText(step.after, order)} highlight={changedRows} />
					</div>
				</div>
				<p class="mt-1" style="color: var(--color-muted);">
					Row r of the result is row r of {uName} times the column {psiIn}: multiply each pair of
					numbers and add them up.
				</p>
			</details>
		{:else if applied.length > 0}
			<p class="text-xs" style="color: var(--color-muted);">
				{#if step.measurements.length > 0}
					This column also measures, so it has no single matrix.
				{:else}
					The full matrix for {n} qubits is {1 << n}×{1 << n}, too big to read. It is shown up to
					{MAX_STEP_MATRIX_QUBITS} qubits; here, open each factor above instead. The full matrix is their
					⊗ product.
				{/if}
			</p>
		{/if}
	{/if}
</div>

<style>
	.changed {
		color: var(--color-probability);
		font-weight: 600;
	}
	/* A factor of the operator line: reads as the formula, with a faint box that
	   shows it can be opened. Opened, it fills with the brand colour. */
	.factor-btn {
		padding: 0 0.3rem;
		border-radius: 0.25rem;
		font-weight: 600;
		color: var(--color-branding);
		border: 1px dashed color-mix(in srgb, var(--color-branding) 45%, transparent);
		cursor: pointer;
		transition: background-color 120ms;
	}
	.factor-btn:hover {
		background: color-mix(in srgb, var(--color-branding) 10%, transparent);
	}
	.factor-btn[aria-pressed='true'] {
		border-style: solid;
		background: color-mix(in srgb, var(--color-branding) 16%, transparent);
	}
	.factor-panel {
		border-radius: 0.375rem;
		padding: 0.5rem 0.625rem;
		border: 1px solid color-mix(in srgb, var(--color-branding) 35%, transparent);
		background: color-mix(in srgb, var(--color-branding) 5%, transparent);
	}
	.close-btn {
		display: flex;
		padding: 0.25rem;
		border-radius: 0.25rem;
		color: var(--color-muted);
		cursor: pointer;
	}
	.close-btn:hover {
		background: color-mix(in srgb, var(--color-text) 8%, transparent);
	}
	.step-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 0.25rem;
		border: 1px solid var(--color-ternary-1);
		color: var(--color-ternary-1);
		cursor: pointer;
	}
	.step-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
</style>
