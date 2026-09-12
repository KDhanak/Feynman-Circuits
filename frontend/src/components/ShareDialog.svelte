<script lang="ts">
	import Icon from '@iconify/svelte';
	import { fade, scale } from 'svelte/transition';

	// Which kind of link the parent made. The user needs to understand how the two
	// are different before sending one, so each has its own text below:
	//   'public' — points to a saved circuit. It stays up to date and can be turned off.
	//   'inline' — holds the circuit itself. It is a snapshot, and can't be taken back once sent.
	export let kind: 'public' | 'inline' = 'inline';
	export let link = '';
	export let open = false;
	export let onCopy: () => void;
	export let onClose: () => void;

	let copied = false;

	// Reset each time it opens, so a reopened dialog does not start on "Copied".
	$: if (!open) copied = false;

	function handleCopy() {
		onCopy();
		copied = true;
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-100 flex items-center justify-center"
		transition:fade={{ duration: 200 }}
	>
		<div
			class="w-[90vw] max-w-md rounded-sm p-5 shadow-sm shadow-ternary-3 backdrop-blur-2xl"
			style="background-color: var(--color-surface);"
			role="dialog"
			aria-modal="true"
			tabindex="0"
			transition:scale={{ duration: 200, start: 0.85 }}
		>
			<div class="mb-3 flex items-center justify-between gap-2">
				<h2 class="text-lg font-semibold" style="color: var(--color-text);">Share this circuit</h2>
				<button type="button" aria-label="Close dialog" on:click={onClose}>
					<Icon
						icon="material-symbols:close"
						width="24"
						height="24"
						class="text-red-500 cursor-pointer"
					/>
				</button>
			</div>

			<div class="flex items-start gap-2 rounded-sm p-3 bg-amber-50">
				<Icon
					icon="ph:warning-bold"
					width="16"
					height="16"
					class="mt-0.5 shrink-0 text-amber-600"
				/>
				<p class="text-sm text-amber-800">
					Anyone with this link can view this circuit. No sign-in required.
				</p>
			</div>

			<label
				class="mt-4 block text-xs font-medium"
				for="share-link"
				style="color: var(--color-muted);"
			>
				Link
			</label>
			<input
				id="share-link"
				type="text"
				readonly
				value={link}
				on:focus={(e) => e.currentTarget.select()}
				class="mt-1 w-full rounded-sm px-2 py-1.5 text-xs font-mono"
				style="background-color: var(--color-background); color: var(--color-text);"
			/>

			<p class="mt-3 text-xs" style="color: var(--color-muted);">
				{#if kind === 'public'}
					This link points at your saved circuit, so it stays up to date as you edit. You can revoke
					it any time from My Circuits &rarr; Make Private.
				{:else}
					The circuit is encoded in the link itself &mdash; nothing is stored on the server. That
					makes it a snapshot: later edits won't change it, and it can't be revoked once you've sent
					it.
				{/if}
			</p>

			<div class="mt-5 flex justify-end gap-2">
				<button type="button" class="btn-primary" on:click={handleCopy}>
					{copied ? 'Copied!' : 'Copy link'}
				</button>
			</div>
		</div>
	</div>
{/if}
