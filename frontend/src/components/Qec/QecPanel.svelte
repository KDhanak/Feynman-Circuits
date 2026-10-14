<script lang="ts">
	import Icon from '@iconify/svelte';
	import LatticePanel from './LatticePanel.svelte';
	import Loader from '../Loader.svelte';
	import { currentSnapshot, currentStep, qecDraft, qecResult, qecRunning } from '$lib/qec/stores';
	import {
		MAX_ERRORS,
		MAX_ROUNDS,
		describeDraft,
		displayRound,
		sortedErrors
	} from '$lib/qec/draft';
	import {
		clearErrors,
		placeError,
		removeError,
		runExperiment,
		setPauli,
		setRound,
		setRounds,
		stepBy
	} from '$lib/qec/actions';
	import { matchingMarks } from '$lib/qec/matching';
	import type { Pauli, TimelineSnapshot } from '$lib/qec/schema';

	const PAULIS: Pauli[] = ['X', 'Y', 'Z'];

	// What the simulation leaves out, said on screen so a learner does not take
	// the clean picture for real hardware.
	const SIMPLIFICATIONS = [
		'Distance 3 only.',
		'Errors you place always happen. There is no random noise.',
		'No gate or measurement errors in your run.',
		'The decoder uses an assumed noise model, not one measured on real hardware.'
	];

	// Which checks notice each Pauli. Shown under the picker so the choice means
	// something before the first run.
	const CAUGHT_BY: Record<Pauli, string> = {
		X: 'Caught by Z checks',
		Y: 'Caught by both X and Z checks',
		Z: 'Caught by X checks'
	};

	const BTN =
		'cursor-pointer rounded-sm border px-2 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40';
	const HEADING = 'text-[0.7rem] font-semibold uppercase tracking-wide opacity-70';
	const FIELD = 'cursor-pointer rounded-sm border px-1.5 py-0.5';
	const FIELD_STYLE =
		'background: var(--color-surface); border-color: var(--color-border); color: var(--color-text)';
	const ROUNDS_OPTIONS = Array.from({ length: MAX_ROUNDS }, (_, i) => i + 1);

	$: total = $qecResult?.timeline.length ?? 0;
	$: step = Math.max(0, Math.min($currentStep, total - 1));
	$: atEnd = total > 0 && step === total - 1;
	$: fired = $currentSnapshot
		? Object.entries($currentSnapshot.measured.detectionEvents)
				.filter(([, v]) => v === 1)
				.map(([id]) => id)
		: [];
	$: verdict = $qecResult?.inferred?.logical ?? null;
	// The same pairings the lattice draws, in words. The lattice is flat, so it
	// cannot show which round each end of a line came from. This list can.
	$: pairings = $qecResult?.inferred
		? matchingMarks($qecResult.inferred.matching, $qecResult.request.rounds)
		: [];
	$: ledger = sortedErrors($qecDraft.errors);
	$: roundOptions = Array.from({ length: $qecDraft.rounds }, (_, i) => i);

	function stepLabel(s: TimelineSnapshot | null): string {
		if (!s) return '';
		if (s.phase === 'decode') return 'Final readout and decoder';
		const r = displayRound(s.round);
		return s.phase === 'inject' ? `Round ${r}: errors placed` : `Round ${r}: checks measured`;
	}

	function errorKey(qubit: number, round: number): string {
		return `${qubit}-${round}`;
	}

	// One line under the step control, answering the question a learner is
	// most likely to have at that step.
	$: hint = !$currentSnapshot
		? ''
		: $currentSnapshot.phase === 'inject'
			? 'Placed, not measured yet. The checks look in the next step.'
			: fired.length
				? `Fired: ${fired.join(', ')}`
				: 'Nothing fired. Checks report changes, not problems.';
</script>

<div class="flex h-full min-h-0 w-full gap-4 text-xs" style="color: var(--color-text)">
	<!-- Left: the lattice, with the step control under it. The step control is
	     passed into the lattice panel so it sits in the same column as the
	     lattice and stays centred on it. -->
	<div class="flex min-w-0 flex-1 flex-col">
		<LatticePanel
			interactive
			planned={$qecDraft.errors}
			on:qubitclick={(e) => placeError(e.detail.qubit)}
		>
			{#if $qecResult}
				<div class="flex items-center justify-center gap-2">
					<button
						type="button"
						class={BTN}
						style="border-color: var(--color-border)"
						aria-label="Previous step"
						disabled={step <= 0}
						on:click={() => stepBy(-1)}
					>
						<Icon icon="ph:caret-left-bold" width="12" height="12" />
					</button>
					<span class="min-w-44 text-center font-semibold">{stepLabel($currentSnapshot)}</span>
					<span class="opacity-60">{step + 1}/{total}</span>
					<button
						type="button"
						class={BTN}
						style="border-color: var(--color-border)"
						aria-label="Next step"
						disabled={atEnd}
						on:click={() => stepBy(1)}
					>
						<Icon icon="ph:caret-right-bold" width="12" height="12" />
					</button>
				</div>
				<p class="text-center text-[0.7rem] opacity-70" aria-live="polite">{hint}</p>
			{:else}
				<!-- While a run is in flight the lattice itself is doing the explaining
			     (the checks light up in measurement order), so this line only says
			     what is happening, not what to do next. -->
				<p class="text-center opacity-70" aria-live="polite">
					{$qecRunning
						? 'Measuring the checks round by round, then decoding.'
						: 'Click a data qubit to place an error, then press Run.'}
				</p>
			{/if}
		</LatticePanel>
	</div>

	<!-- Right: controls, the injection ledger, and the verdict. -->
	<aside class="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto pr-1">
		<section class="flex flex-col gap-1.5">
			<h3 class={HEADING}>Error to place</h3>
			<div class="flex gap-1" role="group" aria-label="Pauli to place">
				{#each PAULIS as p (p)}
					<button
						type="button"
						class="{BTN} w-9 font-semibold {$qecDraft.pauli === p
							? 'border-qec-1 bg-qec-1 text-qec-fg'
							: ''}"
						style={$qecDraft.pauli === p ? '' : 'border-color: var(--color-border)'}
						aria-pressed={$qecDraft.pauli === p}
						on:click={() => setPauli(p)}>{p}</button
					>
				{/each}
			</div>
			<p class="opacity-60">{CAUGHT_BY[$qecDraft.pauli]}</p>

			<label class="flex items-center justify-between gap-2">
				<span>Place in round</span>
				<select
					class={FIELD}
					style={FIELD_STYLE}
					value={$qecDraft.round}
					on:change={(e) => setRound(Number(e.currentTarget.value))}
				>
					{#each roundOptions as r (r)}
						<option value={r}>{displayRound(r)}</option>
					{/each}
				</select>
			</label>

			<label class="flex items-center justify-between gap-2">
				<span>Rounds in the run</span>
				<select
					class={FIELD}
					style={FIELD_STYLE}
					value={$qecDraft.rounds}
					on:change={(e) => setRounds(Number(e.currentTarget.value))}
				>
					{#each ROUNDS_OPTIONS as n (n)}
						<option value={n}>{n}</option>
					{/each}
				</select>
			</label>

			<!-- Reads back the three controls above as one sentence. -->
			<p class="mt-1 leading-snug" aria-live="polite">{describeDraft($qecDraft)}</p>

			<button
				type="button"
				class="{BTN} flex items-center justify-center gap-1.5 border-qec-1 bg-qec-1 font-semibold text-qec-fg"
				disabled={$qecRunning}
				on:click={runExperiment}
			>
				{#if $qecRunning}
					<Loader size={12} />
				{:else}
					<Icon icon="ph:play-bold" width="12" height="12" />
				{/if}
				{$qecRunning ? `Running ${$qecDraft.rounds} rounds...` : 'Run'}
			</button>
		</section>

		<!-- The injection ledger: the one place layer 1 is written down in full, so
		     the truth never has to be read back off the picture. -->
		<section class="flex flex-col gap-1.5">
			<div class="flex items-center justify-between">
				<h3 class={HEADING}>Errors placed <span class="normal-case">(truth)</span></h3>
				{#if ledger.length}
					<button type="button" class="cursor-pointer underline opacity-70" on:click={clearErrors}
						>Clear</button
					>
				{/if}
			</div>
			{#if ledger.length}
				<ul class="flex flex-col gap-0.5">
					{#each ledger as e (errorKey(e.qubit, e.round))}
						<li class="flex items-center justify-between gap-2">
							<span
								><span class="font-semibold">{e.pauli}</span> on q{e.qubit}
								<span class="opacity-60">· round {displayRound(e.round)}</span></span
							>
							<button
								type="button"
								class="cursor-pointer opacity-60 hover:opacity-100"
								aria-label="Remove {e.pauli} on qubit {e.qubit}, round {displayRound(e.round)}"
								on:click={() => removeError(e.qubit, e.round)}
							>
								<Icon icon="ph:x-bold" width="11" height="11" />
							</button>
						</li>
					{/each}
				</ul>
				<p class="opacity-50">{ledger.length} of {MAX_ERRORS}</p>
			{:else}
				<p class="opacity-70">None yet. Click a data qubit on the lattice.</p>
			{/if}
			<!-- Always shown. Placing errors by hand reveals the one thing real
			     hardware never does, so we say so right where that truth is listed. -->
			<p class="leading-snug opacity-70">
				These are simulation ground truth. Real hardware never shows which physical error happened;
				it only shows the checks.
			</p>
		</section>

		<!-- Layer 3. Shown only on the last step, because the decoder works on the
		     whole history at once: there is no decoder answer part-way through. -->
		{#if $qecResult && verdict}
			<section class="flex flex-col gap-1">
				<h3 class={HEADING}>Decoder verdict</h3>
				{#if atEnd}
					<p>
						Logical qubit flipped: <span class="font-semibold"
							>{verdict.observedFlip ? 'yes' : 'no'}</span
						>
						<span class="opacity-60">(truth)</span>
					</p>
					<p>
						Decoder predicted a flip: <span class="font-semibold"
							>{verdict.predictedFlip ? 'yes' : 'no'}</span
						>
						<span class="opacity-60">(guess)</span>
					</p>
					<p
						class="mt-1 flex items-start gap-1.5 font-semibold"
						style={verdict.success ? '' : 'color: var(--color-danger)'}
					>
						<Icon
							icon={verdict.success ? 'ph:check-circle-bold' : 'ph:warning-bold'}
							width="14"
							height="14"
							class="mt-px shrink-0"
						/>
						{verdict.success
							? 'Decoder was right. Its correction leaves the logical qubit correct.'
							: 'Decoder was wrong. The logical qubit ends up corrupted.'}
					</p>
					<h4 class="mt-2 font-semibold">
						How it paired the events <span class="opacity-60">(guess)</span>
					</h4>
					{#if pairings.length}
						<ul class="flex list-disc flex-col gap-0.5 pl-4 leading-snug">
							{#each pairings as p, i (i)}
								<li>{p.label}</li>
							{/each}
						</ul>
					{:else}
						<p class="opacity-70">Nothing to pair: no check fired.</p>
					{/if}
				{:else}
					<p class="opacity-70">Step to the end to see it.</p>
				{/if}
			</section>
		{/if}

		<section class="flex flex-col gap-1">
			<h3 class={HEADING}>What this simulation leaves out</h3>
			<ul class="flex list-disc flex-col gap-0.5 pl-4 leading-snug opacity-70">
				{#each SIMPLIFICATIONS as s (s)}
					<li>{s}</li>
				{/each}
			</ul>
		</section>
	</aside>
</div>
