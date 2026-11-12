<script lang="ts">
	import BlochSphere from './BlochSphere.svelte';
	import QSphere from './QSphere.svelte';
	import { circuitIR, simulationResult } from '$lib/IR/stores';
	import { settings } from '$lib/stores/settingsStore';
	import { createComplex } from '$lib/quantum/complex';
	import { QSPHERE_MAX_QUBITS } from '$lib/quantum/qsphere';

	/**
	 * The big sphere in the results row.
	 * - 1 qubit: its Bloch sphere, which is that qubit's whole state.
	 * - 2 to QSPHERE_MAX_QUBITS qubits: the Q-sphere, which shows every basis
	 *   state. It used to show the average of the qubits' Bloch vectors, which
	 *   loses the entanglement: a Bell pair averaged to the centre.
	 * - More qubits: a short note. The small Bloch spheres on the wires stay.
	 */
	$: n = $circuitIR.registers.q;
	$: vectors = $simulationResult.blochVectors ?? [];
	// The state is missing only in the moment before the first simulation; then
	// the board is still at |0…0⟩.
	$: state =
		$simulationResult.state?.length === 1 << n
			? $simulationResult.state
			: Array.from({ length: 1 << n }, (_, i) => createComplex(i === 0 ? 1 : 0, 0));

	$: mode = n <= 1 ? 'bloch' : n <= QSPHERE_MAX_QUBITS ? 'qsphere' : 'off';
	$: caption =
		mode === 'bloch'
			? 'State of qubit 0'
			: 'Each dot is a basis state: size is its probability, colour its phase';

	// The sphere's size comes from the panel it is in, not from the window, so it
	// also grows when the results row is dragged taller. The wrapper is
	// h-full/w-full, so its size comes from the panel and never from the sphere
	// inside it. Otherwise measuring it would change the very size we are measuring.
	let boxH = 0;
	// The text under the sphere is always one 0.75rem line. The caption can be
	// one or two lines, so we measure it instead.
	const READOUT_H = 18;
	let captionH = 16;
	const MIN_SIZE = 120;
	const MAX_SIZE = 420;

	// Height only. The panel is an `auto` grid column, so its width comes from
	// this sphere. Using boxW here would go in a circle and keep the sphere stuck
	// at whatever size it first had. The height comes from the results row, which
	// doesn't depend on the sphere, so it is safe to size from.
	$: sphereSize = Math.round(
		Math.max(MIN_SIZE, Math.min(boxH - READOUT_H - captionH - 4, MAX_SIZE))
	);
</script>

<div class="flex h-full w-full flex-col items-center justify-center" bind:clientHeight={boxH}>
	{#if mode === 'off'}
		<div class="max-w-[16rem] text-center text-sm text-muted">
			<p class="font-semibold text-text">Q-sphere: up to {QSPHERE_MAX_QUBITS} qubits</p>
			<p class="mt-1 text-xs leading-snug">
				This circuit has {n} qubits, which is {(1 << n).toLocaleString()} states: too many to read as
				dots. The results panel lists the most likely ones, and each wire still shows its own Bloch sphere.
			</p>
		</div>
	{:else}
		{#if mode === 'bloch'}
			<BlochSphere
				vector={vectors[0] ?? { qubit: 0, x: 0, y: 0, z: 1, magnitude: 1 }}
				size={sphereSize}
				showAxisLabels={true}
				interactive={true}
			/>
		{:else}
			<QSphere {state} size={sphereSize} bitOrder={$settings.bitOrder} />
		{/if}
		<p
			bind:clientHeight={captionH}
			class="mt-1 max-w-[16rem] text-center text-[0.7rem] leading-tight text-muted"
		>
			{caption}
		</p>
	{/if}
</div>
