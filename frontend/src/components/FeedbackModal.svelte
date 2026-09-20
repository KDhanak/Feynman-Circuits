<script lang="ts">
	import { resolve } from '$app/paths';
	import { fly, fade } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import Loader from './Loader.svelte';
	import { submitFeedback, type FeedbackPayload } from '$lib/api/feedbackApi';

	export let onClose: () => void = () => {};

	type Step = 'type' | 'form' | 'success';
	type FeedbackType = 'bug' | 'feature';

	let step: Step = 'type';
	let feedbackType: FeedbackType = 'bug';
	let loading = false;
	let errorMsg = '';

	// Bug fields
	let bugArea = '';
	let bugDescription = '';
	let bugExpected = '';
	let bugActual = '';

	// Feature fields
	let featureArea = '';
	let featureDescription = '';
	let featureImpact = '';

	// Common fields
	let extra = '';
	let senderName = '';
	let senderEmail = '';

	const bugAreas = [
		'Gate Palette',
		'Circuit Board',
		'Simulation Results',
		'Bloch Sphere',
		'Saving & Circuits',
		'Account & Authentication',
		'Something else'
	];

	const featureAreas = [
		'Circuit Building & Gates',
		'Simulation & Results',
		'Bloch Sphere Visualization',
		'Export & Import (OpenQASM)',
		'Account & Cloud Saving',
		'Performance',
		'Something else'
	];

	function selectType(type: FeedbackType) {
		feedbackType = type;
		step = 'form';
		errorMsg = '';
	}

	function goBack() {
		step = 'type';
		errorMsg = '';
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) onClose();
	}

	async function handleSubmit() {
		errorMsg = '';

		const area = feedbackType === 'bug' ? bugArea : featureArea;
		const description = feedbackType === 'bug' ? bugDescription : featureDescription;

		if (!area) {
			errorMsg = 'Please select an area.';
			return;
		}
		if (!description.trim()) {
			errorMsg =
				feedbackType === 'bug'
					? 'Please describe what you were trying to do.'
					: 'Please describe the feature you have in mind.';
			return;
		}

		loading = true;
		try {
			const payload: FeedbackPayload = {
				type: feedbackType,
				area,
				description: description.trim(),
				extra: extra.trim() || undefined,
				name: senderName.trim() || undefined,
				email: senderEmail.trim() || undefined
			};
			if (feedbackType === 'bug') {
				payload.expected = bugExpected.trim() || undefined;
				payload.actual = bugActual.trim() || undefined;
			} else {
				payload.impact = featureImpact.trim() || undefined;
			}
			await submitFeedback(payload);
			step = 'success';
		} catch {
			errorMsg = 'Something went wrong. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<!-- Backdrop -->
<div
	class="fixed inset-0 z-200 flex items-center justify-center p-4"
	style="background-color: rgba(0,0,0,0.45); backdrop-filter: blur(4px);"
	role="button"
	tabindex="0"
	aria-label="Close feedback"
	on:click={handleBackdropClick}
	on:keydown={(e) => e.key === 'Escape' && onClose()}
	transition:fade={{ duration: 200 }}
>
	<!-- Modal card -->
	<div
		class="relative w-full max-w-lg rounded-sm shadow-2xl overflow-hidden"
		style="background-color: var(--color-surface); border: 1px solid var(--color-border);"
		transition:fly={{ y: 24, duration: 280 }}
		role="dialog"
		aria-modal="true"
		aria-label="Feedback"
	>
		<!-- Header -->
		<div
			class="flex items-center justify-between px-6 py-4"
			style="border-bottom: 1px solid var(--color-border);"
		>
			<div class="flex items-center gap-2">
				{#if step === 'form'}
					<button
						type="button"
						class="cursor-pointer mr-1"
						style="color: var(--color-text);"
						on:click={goBack}
					>
						<Icon icon="material-symbols:arrow-back" width="20" height="20" />
					</button>
				{/if}
				<h2 class="text-lg font-semibold" style="color: var(--color-text);">
					{#if step === 'type'}Share Feedback{:else if step === 'form'}{feedbackType === 'bug'
							? 'Bug Report'
							: 'Feature Request'}{:else}Thank You!{/if}
				</h2>
			</div>
			<button type="button" aria-label="Close" on:click={onClose}>
				<Icon
					icon="material-symbols:close"
					class="cursor-pointer text-red-500"
					width="24"
					height="24"
				/>
			</button>
		</div>

		<!-- Body -->
		<div class="px-6 py-5 max-h-[75vh] overflow-y-auto">
			{#if step === 'type'}
				<!-- Step 1: Type selection -->
				<p class="text-sm mb-5" style="color: var(--color-muted);">
					Found something that's not working, or have an idea that would make Feynman Circuits
					better? I'd love to hear it.
				</p>
				<div class="grid grid-cols-2 gap-3">
					<button
						type="button"
						on:click={() => selectType('bug')}
						class="type-btn type-btn-bug flex flex-col items-center gap-3 p-5 rounded-sm border-2 cursor-pointer transition-all duration-150 text-left"
					>
						<span class="text-3xl">🐛</span>
						<div>
							<p class="font-semibold text-sm mb-1" style="color: var(--color-text);">Bug Report</p>
							<p class="text-xs leading-relaxed" style="color: var(--color-muted);">
								Something isn't working the way you'd expect
							</p>
						</div>
					</button>
					<button
						type="button"
						on:click={() => selectType('feature')}
						class="type-btn type-btn-feature flex flex-col items-center gap-3 p-5 rounded-sm border-2 cursor-pointer transition-all duration-150 text-left"
					>
						<span class="text-3xl">✨</span>
						<div>
							<p class="font-semibold text-sm mb-1" style="color: var(--color-text);">
								Feature Request
							</p>
							<p class="text-xs leading-relaxed" style="color: var(--color-muted);">
								Something you'd love Feynman Circuits to do
							</p>
						</div>
					</button>
				</div>
			{:else if step === 'form'}
				<!-- Step 2: Form -->
				<form class="space-y-4" on:submit|preventDefault={handleSubmit}>
					<!-- Area selector -->
					<div>
						<label
							for="fb-area"
							class="mb-1 block text-sm font-medium"
							style="color: var(--color-text);"
						>
							{feedbackType === 'bug'
								? 'Which part were you using?'
								: 'Which area would this improve?'}
							<span class="text-red-500 ml-0.5">*</span>
						</label>
						<select
							id="fb-area"
							class="input-field"
							value={feedbackType === 'bug' ? bugArea : featureArea}
							on:change={(e) => {
								if (feedbackType === 'bug') bugArea = e.currentTarget.value;
								else featureArea = e.currentTarget.value;
							}}
						>
							<option value="" disabled>Select an area…</option>
							{#each feedbackType === 'bug' ? bugAreas : featureAreas as area (area)}
								<option value={area}>{area}</option>
							{/each}
						</select>
					</div>

					{#if feedbackType === 'bug'}
						<!-- What were you trying to do -->
						<div>
							<label
								for="fb-description"
								class="mb-1 block text-sm font-medium"
								style="color: var(--color-text);"
							>
								What were you trying to do? <span class="text-red-500 ml-0.5">*</span>
							</label>
							<textarea
								id="fb-description"
								class="input-field resize-none"
								rows="3"
								placeholder="e.g. I was building a Bell state circuit with two qubits and applying a CNOT gate…"
								bind:value={bugDescription}
							></textarea>
						</div>

						<!-- What did you expect -->
						<div>
							<label
								for="fb-expected"
								class="mb-1 block text-sm font-medium"
								style="color: var(--color-text);"
							>
								What did you expect to happen?
							</label>
							<textarea
								id="fb-expected"
								class="input-field resize-none"
								rows="2"
								placeholder="e.g. The simulation should have shown a 50/50 superposition…"
								bind:value={bugExpected}
							></textarea>
						</div>

						<!-- What actually happened -->
						<div>
							<label
								for="fb-actual"
								class="mb-1 block text-sm font-medium"
								style="color: var(--color-text);"
							>
								What actually happened?
							</label>
							<textarea
								id="fb-actual"
								class="input-field resize-none"
								rows="2"
								placeholder="e.g. The probability result stayed at 100% |00⟩ even after adding the Hadamard…"
								bind:value={bugActual}
							></textarea>
						</div>
					{:else}
						<!-- Feature description -->
						<div>
							<label
								for="fb-description"
								class="mb-1 block text-sm font-medium"
								style="color: var(--color-text);"
							>
								What would you like Feynman Circuits to be able to do?
								<span class="text-red-500 ml-0.5">*</span>
							</label>
							<textarea
								id="fb-description"
								class="input-field resize-none"
								rows="3"
								placeholder="e.g. I'd love to be able to label each qubit with a custom name, so it's easier to follow along in multi-qubit circuits…"
								bind:value={featureDescription}
							></textarea>
						</div>

						<!-- How would it change your workflow -->
						<div>
							<label
								for="fb-impact"
								class="mb-1 block text-sm font-medium"
								style="color: var(--color-text);"
							>
								How would this change the way you use it?
							</label>
							<textarea
								id="fb-impact"
								class="input-field resize-none"
								rows="2"
								placeholder="e.g. Right now I lose track of which qubit is which once I'm past 3 qubits. Custom labels would make circuits much easier to read…"
								bind:value={featureImpact}
							></textarea>
						</div>
					{/if}

					<!-- Divider -->
					<hr style="border-color: var(--color-border);" />

					<!-- Anything else -->
					<div>
						<label
							for="fb-extra"
							class="mb-1 block text-sm font-medium"
							style="color: var(--color-text);"
						>
							Anything else you'd like to add? <span
								class="text-xs font-normal"
								style="color: var(--color-muted);">(optional)</span
							>
						</label>
						<textarea
							id="fb-extra"
							class="input-field resize-none"
							rows="2"
							placeholder="Any extra context, screenshots to describe, or thoughts…"
							bind:value={extra}
						></textarea>
					</div>

					<!-- Name -->
					<div>
						<label
							for="fb-name"
							class="mb-1 block text-sm font-medium"
							style="color: var(--color-text);"
						>
							Your name <span class="text-xs font-normal" style="color: var(--color-muted);"
								>(optional — leave blank to stay anonymous)</span
							>
						</label>
						<input
							id="fb-name"
							type="text"
							class="input-field"
							placeholder="Anonymous"
							bind:value={senderName}
						/>
					</div>

					<!-- Email -->
					<div>
						<label
							for="fb-email"
							class="mb-1 block text-sm font-medium"
							style="color: var(--color-text);"
						>
							Your email <span class="text-xs font-normal" style="color: var(--color-muted);"
								>(optional — only if you'd like a reply)</span
							>
						</label>
						<input
							id="fb-email"
							type="email"
							class="input-field"
							placeholder="you@example.com"
							bind:value={senderEmail}
						/>
						<p class="mt-1 text-xs" style="color: var(--color-muted);">
							Your feedback is sent to us by email and is not stored in the app. See our
							<a
								href={resolve('/privacy')}
								target="_blank"
								rel="noopener"
								class="underline underline-offset-2">Privacy Policy</a
							>.
						</p>
					</div>

					{#if errorMsg}
						<p class="text-sm font-bold text-red-500">{errorMsg}</p>
					{/if}

					<button
						type="submit"
						class="btn-primary flex w-full items-center justify-center gap-2"
						disabled={loading}
					>
						{#if loading}<Loader size={14} />{/if}
						{loading ? 'Sending…' : 'Send feedback'}
					</button>
				</form>
			{:else}
				<!-- Step 3: Success -->
				<div class="flex flex-col items-center text-center py-6 gap-4">
					<span class="text-5xl">🙌</span>
					<h3 class="text-xl font-semibold" style="color: var(--color-text);">
						{senderName ? `Thank you, ${senderName}!` : 'Thank you!'}
					</h3>
					<p class="text-sm leading-relaxed max-w-xs" style="color: var(--color-muted);">
						Your {feedbackType === 'bug' ? 'bug report' : 'idea'} has been sent. I read every single message
						and use them to make Feynman Circuits better.
						{#if senderEmail}I'll reply to <strong>{senderEmail}</strong> if I have follow-up questions.{/if}
					</p>
					<button type="button" class="btn-primary mt-2" on:click={onClose}>Close</button>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.type-btn {
		border-color: var(--color-border);
		background: var(--color-surface);
	}
	.type-btn-bug:hover {
		border-color: #dc2626;
	}
	.type-btn-feature:hover {
		border-color: #7c3aed;
	}
</style>
