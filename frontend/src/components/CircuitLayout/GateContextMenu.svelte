<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { UnitaryOperation } from '$lib/IR/schema';
	import { circuitIR } from '$lib/IR/stores';
	import { updateOperation } from '$lib/IR/operations';
	import { triggerSimulation } from '$lib/circuit/dragDropUtils';
	import { parsePiInput, formatRadiansAsPi } from '$lib/utils/piMath';

	export let gate: UnitaryOperation;
	export let x: number;
	export let y: number;

	const dispatch = createEventDispatcher<{ close: void }>();

	let angle = '';
	let target0 = 0;
	let target1 = 1;
	let error = '';

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
			if (t0 === t1) { error = 'Targets must be different.'; return; }
			if (t0 < 0 || t0 >= numQubits || t1 < 0 || t1 >= numQubits) {
				error = `Each target must be between 0 and ${numQubits - 1}.`;
				return;
			}
			updateOperation(gate.id, (op) => ({ ...(op as UnitaryOperation), targets: [t0, t1] }));
		} else {
			const parsed = parsePiInput(angle);
			if (parsed === null) { error = 'Enter an angle like pi/2, pi/4, or a number in radians.'; return; }
			updateOperation(gate.id, (op) => ({ ...(op as UnitaryOperation), params: [parsed] }));
		}

		triggerSimulation($circuitIR);
		dispatch('close');
	}

	// Enter inside any field commits the edit, mirroring the Apply button.
	function onFieldKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			apply();
		}
	}
</script>

<div
	class="ctx-menu gate-ctx-menu z-200 w-52 bg-background border border-ternary-2"
	style="left: {x}px; top: {y}px; color: var(--color-text);"
	role="menu"
	tabindex="0"
	on:click|stopPropagation={() => {}}
	on:keydown={(e) => { if (e.key === 'Escape') dispatch('close'); }}
>
	<div class="px-4 py-2 text-xs font-semibold border-b border-gray-100 uppercase tracking-wide">
		Edit {gate.gate.toUpperCase()} Gate
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
					class="input-field py-1.5 text-sm"
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
					class="input-field py-1.5 text-sm"
				/>
			</div>
			{#if error}
				<p class="text-xs text-red-500">{error}</p>
			{/if}
		</div>
	{:else}
		<div class="px-4 py-3">
			<label class="block text-xs mb-1" for="gate-angle">
				Angle (e.g. pi/2, pi/4, 3pi/4)
			</label>
			<input
				id="gate-angle"
				type="text"
				bind:value={angle}
				on:keydown={onFieldKeydown}
				class="input-field py-1.5 text-sm"
			/>
			{#if error}
				<p class="mt-1 text-xs text-red-500">{error}</p>
			{/if}
		</div>
	{/if}

	<div class="flex gap-2 px-4 py-2.5 border-t border-gray-100">
		<button class="btn-primary flex-1 py-1.5 text-sm" on:click={apply}>Apply</button>
		<button class="btn-secondary flex-1 py-1.5 text-sm" on:click={() => dispatch('close')}>Cancel</button>
	</div>
</div>
