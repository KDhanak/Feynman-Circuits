<script lang="ts">
	import { onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import { demoRunning } from '$lib/stores/uiStores';
	import { caption, hand, stopBoardDemo } from '$lib/demo/boardDemo';

	/**
	 * Draws the board demo on top of the page: the hand, its click ripples, the
	 * gate it carries, the keys it presses, and a caption card with a Stop
	 * button. It also keeps the user's own mouse and keys off the board while
	 * the demo plays, so the two never fight over the circuit. The demo itself
	 * (what really changes on the board) is in lib/demo/boardDemo.ts.
	 */

	// The user's keys are held back while the demo plays, except Esc, which stops
	// it. Only real key presses are held back: the demo's own typing (the Enter
	// in the angle box) is made by code, so `isTrusted` is false for it.
	function onKey(e: KeyboardEvent) {
		if (!e.isTrusted) return;
		e.preventDefault();
		e.stopPropagation();
		if (e.key === 'Escape') stopBoardDemo();
	}

	let listening = false;
	$: if (typeof window !== 'undefined' && $demoRunning !== listening) {
		listening = $demoRunning;
		// Capture phase, so this runs before the board's own key handlers.
		if (listening) window.addEventListener('keydown', onKey, true);
		else window.removeEventListener('keydown', onKey, true);
	}
	onDestroy(() => {
		if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey, true);
	});

	// Text in `backticks` is drawn as a key cap, as in the tour.
	$: bodyParts = ($caption?.body ?? '').split('`');
	$: progress = $caption ? Math.min(1, $caption.index / $caption.count) : 0;

	// The card sits at the bottom of the screen, but moves to the top while the
	// hand works down there (the undo buttons on a phone), so it never covers
	// what the hand is showing.
	let viewportHeight = 800;
	$: captionAtTop = $hand.visible && $hand.y > viewportHeight * 0.62;

	// Puts the carried gate copy inside the element. The copy is a real element,
	// not HTML text, so no {@html} is needed.
	function holdCopy(target: HTMLElement, copy: HTMLElement) {
		target.replaceChildren(copy);
		return {
			update(next: HTMLElement) {
				target.replaceChildren(next);
			}
		};
	}
</script>

<svelte:window bind:innerHeight={viewportHeight} />

{#if $demoRunning}
	<!-- Holds back the user's clicks, scrolling and touches while the demo plays.
	     Scrolling would move the board out from under the hand. -->
	<div
		class="fixed inset-0 z-400 cursor-default"
		role="presentation"
		on:wheel|preventDefault
		on:touchmove|preventDefault
		on:mousedown|preventDefault
		transition:fade={{ duration: 150 }}
	></div>

	{#if $hand.visible}
		<div
			class="hand pointer-events-none fixed left-0 top-0 z-402"
			style="transform: translate({$hand.x}px, {$hand.y}px);"
			aria-hidden="true"
			transition:fade={{ duration: 200 }}
		>
			{#if $hand.carrying}
				<!-- A copy of the gate being dragged, cloned from the board. -->
				<div class="carried" use:holdCopy={$hand.carrying}></div>
			{/if}

			{#key $hand.clicks}
				{#if $hand.clicks > 0}<span class="ripple"></span>{/if}
			{/key}
			{#if $hand.holding}<span class="hold-ring"></span>{/if}

			<div class="finger" class:pressed={$hand.pressed}>
				<Icon icon="ph:hand-pointing-fill" width="34" height="34" />
			</div>

			{#if $hand.gesture}
				<span class="tag" transition:fade={{ duration: 120 }}>{$hand.gesture}</span>
			{/if}
			{#if $hand.keys.length}
				<span class="keys" transition:fade={{ duration: 120 }}>
					{#each $hand.keys as key, i (i)}{#if i > 0}<span class="plus">+</span>{/if}<kbd>{key}</kbd
						>{/each}
				</span>
			{/if}
		</div>
	{/if}

	{#if $caption}
		<div
			class="caption fixed left-1/2 z-401 w-[min(26rem,calc(100vw-2rem))] rounded-md p-4 shadow-lg"
			class:at-top={captionAtTop}
			role="status"
			aria-live="polite"
			transition:fade={{ duration: 200 }}
		>
			<div class="flex items-start justify-between gap-3">
				{#key $caption.title}
					<div class="min-w-0" in:fade={{ duration: 200 }}>
						<h2 class="text-sm font-semibold" style="color: var(--color-text);">
							{$caption.title}
						</h2>
						<p class="mt-0.5 text-xs leading-relaxed" style="color: var(--color-muted);">
							{#each bodyParts as part, i (i)}{#if i % 2 === 1}<kbd>{part}</kbd
									>{:else}{part}{/if}{/each}
						</p>
					</div>
				{/key}
				<button type="button" class="btn-quiet h-8 shrink-0 !text-xs" on:click={stopBoardDemo}>
					<Icon icon="ph:stop-fill" width="12" height="12" />
					Stop
				</button>
			</div>
			<div class="mt-3 h-1 overflow-hidden rounded-full" style="background: var(--color-border);">
				<div
					class="h-full rounded-full transition-[width] duration-500"
					style="width: {progress * 100}%; background: var(--color-accent);"
				></div>
			</div>
			<p class="mt-1.5 text-[10px]" style="color: var(--color-muted);">
				Demo on a practice board · <kbd>Esc</kbd> stops · your circuit comes back after
			</p>
		</div>
	{/if}
{/if}

<style>
	.caption {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		top: calc(100vh - 1rem);
		transform: translate(-50%, -100%);
		transition:
			top 300ms ease,
			transform 300ms ease;
	}
	.caption.at-top {
		top: 1rem;
		transform: translate(-50%, 0);
	}

	/* The hand's point is its fingertip, so the icon is moved so that the tip
	   sits exactly on the point the hand is at. */
	.finger {
		position: absolute;
		left: 0;
		top: 0;
		transform: translate(-40%, -6%);
		transform-origin: 40% 6%;
		transition: transform 120ms ease-out;
		color: var(--color-text);
		filter: drop-shadow(0 0 1.5px var(--color-surface)) drop-shadow(0 0 1px var(--color-surface))
			drop-shadow(0 3px 4px rgb(0 0 0 / 0.35));
	}
	.finger.pressed {
		transform: translate(-40%, -6%) scale(0.86);
	}

	.carried {
		position: absolute;
		left: 0;
		top: 0;
		opacity: 0.9;
		transform: translate(10px, 14px) rotate(-4deg);
		filter: drop-shadow(0 6px 8px rgb(0 0 0 / 0.25));
	}

	.ripple,
	.hold-ring {
		position: absolute;
		left: 0;
		top: 0;
		width: 36px;
		height: 36px;
		margin: -18px 0 0 -18px;
		border-radius: 9999px;
	}
	.ripple {
		border: 2px solid var(--color-accent);
		animation: ripple 450ms ease-out forwards;
	}
	@keyframes ripple {
		from {
			transform: scale(0.3);
			opacity: 1;
		}
		to {
			transform: scale(1.4);
			opacity: 0;
		}
	}
	.hold-ring {
		border: 3px solid color-mix(in srgb, var(--color-accent) 25%, transparent);
		border-top-color: var(--color-accent);
		animation: hold 750ms linear forwards;
	}
	@keyframes hold {
		to {
			transform: rotate(360deg);
		}
	}

	.tag,
	.keys {
		position: absolute;
		left: 22px;
		white-space: nowrap;
		font-size: 11px;
		font-weight: 600;
	}
	.tag {
		top: 30px;
		padding: 2px 8px;
		border-radius: 9999px;
		color: var(--color-accent-fg, #fff);
		background: var(--color-accent);
	}
	.keys {
		top: -34px;
		display: flex;
		align-items: center;
		gap: 3px;
		color: var(--color-text);
	}
	.plus {
		opacity: 0.6;
	}

	kbd {
		display: inline-block;
		padding: 0 0.35em;
		border-radius: 0.25rem;
		border: 1px solid var(--color-border-strong);
		border-bottom-width: 2px;
		background: var(--color-surface-2);
		color: var(--color-text);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.95em;
		line-height: 1.4;
	}
	.keys kbd {
		font-size: 13px;
		padding: 1px 6px;
		box-shadow: 0 2px 4px rgb(0 0 0 / 0.2);
	}
</style>
