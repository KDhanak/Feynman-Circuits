<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import type { UnitaryOperation } from '$lib/IR/schema';
	import { circuitIR } from '$lib/IR/stores';
	import { updateOperation } from '$lib/IR/operations';
	import { triggerSimulation } from '$lib/circuit/dragDropUtils';
	import { parsePiInput, formatRadiansAsPi } from '$lib/utils/piMath';
	import { isMobile } from '$lib/stores/isMobile';
	import Icon from '@iconify/svelte';

	export let gate: UnitaryOperation;
	export let x: number;
	export let y: number;

	const dispatch = createEventDispatcher<{ close: void }>();

	// The menu is placed (position: fixed) at the anchor it is given, which pushes it
	// off screen for a gate near the right or bottom edge: in small desktop windows,
	// and for almost any gate on a phone. Once it has been measured, move it back
	// inside the screen. For the very first draw, it just uses the anchor as it is.
	const MARGIN = 8;
	let menuEl: HTMLDivElement | undefined;
	let posStyle = '';
	$: posStyle = `left: ${x}px; top: ${y}px;`;
	$: clampIntoViewport(x, y, menuEl);

	async function clampIntoViewport(nx: number, ny: number, el: HTMLDivElement | undefined) {
		if (!el) return;
		await tick(); // let the menu render so we can measure it
		const w = el.offsetWidth;
		const h = el.offsetHeight;
		const left = Math.max(MARGIN, Math.min(nx, window.innerWidth - w - MARGIN));
		const top = Math.max(MARGIN, Math.min(ny, window.innerHeight - h - MARGIN));
		posStyle = `left: ${left}px; top: ${top}px;`;
	}

	let angle = '';
	let target0 = 0;
	let target1 = 1;
	let error = '';

	// Bigger buttons on touch screens. The desktop sizes are too small to tap
	// easily.
	$: fieldClass = `input-field text-sm ${$isMobile ? 'py-2.5' : 'py-1.5'}`;
	$: iconBtnSize = $isMobile ? 'h-9 w-9' : 'h-7 w-7';

	// Reset internal state whenever a different gate is opened
	$: {
		if (gate.gate === 'swap') {
			target0 = gate.targets[0];
			target1 = gate.targets[1] ?? 1;
		} else {
			angle = formatRadiansAsPi(gate.params[0] ?? 0);
		}
		error = '';
	}

	function apply() {
		error = '';

		if (gate.gate === 'swap') {
			const numQubits = $circuitIR.registers.q;
			const t0 = Number(target0);
			const t1 = Number(target1);
			if (t0 === t1) {
				error = 'Targets must be different.';
				return;
			}
			if (t0 < 0 || t0 >= numQubits || t1 < 0 || t1 >= numQubits) {
				error = `Each target must be between 0 and ${numQubits - 1}.`;
				return;
			}
			updateOperation(gate.id, (op) => ({ ...(op as UnitaryOperation), targets: [t0, t1] }));
		} else {
			const parsed = parsePiInput(angle);
			if (parsed === null) {
				error = 'Enter an angle like pi/2, pi/4, or a number in radians.';
				return;
			}
			updateOperation(gate.id, (op) => ({ ...(op as UnitaryOperation), params: [parsed] }));
		}

		triggerSimulation($circuitIR);
		dispatch('close');
	}

	// Pressing Enter in any field saves the edit, just like the Apply button.
	function onFieldKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			apply();
		}
	}
</script>

<div
	bind:this={menuEl}
	class="ctx-menu gate-ctx-menu z-200 {$isMobile
		? 'w-60'
		: 'w-52'} bg-background border border-ternary-2"
	style="{posStyle} color: var(--color-text);"
	role="menu"
	tabindex="0"
	on:click|stopPropagation={() => {}}
	on:keydown={(e) => {
		if (e.key === 'Escape') dispatch('close');
	}}
>
	<!-- Save and cancel sit in the header as small icon buttons, so the card
	     doesn't need a whole row of full-width buttons at the bottom. -->
	<div
		class="flex items-center justify-between gap-2 pl-4 pr-2 py-1.5 border-b"
		style="border-color: var(--color-border)"
	>
		<span class="text-xs font-semibold uppercase tracking-wide">
			Edit {gate.gate.toUpperCase()} Gate
		</span>
		<div class="flex items-center gap-1">
			<button
				class="icon-btn {iconBtnSize} text-ternary-1"
				title="Apply"
				aria-label="Apply"
				on:click={apply}
			>
				<Icon icon="ph:check-bold" width="16" height="16" />
			</button>
			<button
				class="icon-btn {iconBtnSize} text-text"
				title="Cancel"
				aria-label="Cancel"
				on:click={() => dispatch('close')}
			>
				<Icon icon="ph:x-bold" width="16" height="16" />
			</button>
		</div>
	</div>

	{#if gate.gate === 'swap'}
		<div class="px-4 py-3 space-y-2">
			<div>
				<label class="block text-xs mb-1" for="swap-t0">Target 1</label>
				<input
					id="swap-t0"
					type="number"
					min="0"
					max={$circuitIR.registers.q - 1}
					bind:value={target0}
					on:keydown={onFieldKeydown}
					class={fieldClass}
				/>
			</div>
			<div>
				<label class="block text-xs mb-1" for="swap-t1">Target 2</label>
				<input
					id="swap-t1"
					type="number"
					min="0"
					max={$circuitIR.registers.q - 1}
					bind:value={target1}
					on:keydown={onFieldKeydown}
					class={fieldClass}
				/>
			</div>
			{#if error}
				<p class="text-xs text-red-500">{error}</p>
			{/if}
		</div>
	{:else}
		<div class="px-4 py-3">
			<label class="block text-xs mb-1" for="gate-angle"> Angle (e.g. pi/2, pi/4, 3pi/4) </label>
			<input
				id="gate-angle"
				type="text"
				bind:value={angle}
				on:keydown={onFieldKeydown}
				class={fieldClass}
			/>
			{#if error}
				<p class="mt-1 text-xs text-red-500">{error}</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.25rem;
		cursor: pointer;
		transition: background-color 100ms;
	}
	.icon-btn:hover {
		background: var(--color-border);
	}
</style>
