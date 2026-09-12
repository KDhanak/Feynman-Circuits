<script lang="ts">
	import BlochSphere from './BlochSphere.svelte';
	import { simulationResult } from '$lib/IR/stores';
	import { computeOverallBlochVector } from '$lib/quantum/bloch';

	$: vectors = $simulationResult.blochVectors ?? [];
	$: overall = computeOverallBlochVector(vectors);
	// One sphere can only show one qubit's state, so for multi-qubit circuits
	// this is the average of all the qubits' vectors. We say so, instead of making
	// it look like the state of the whole register.
	$: caption =
		vectors.length > 1
			? `Average over ${vectors.length} qubits — not the full ${vectors.length}-qubit state`
			: 'State of qubit 0';

	// The sphere's size comes from the panel it is in, not from the window, so it
	// also grows when the results row is dragged taller. The wrapper is
	// h-full/w-full, so its size comes from the panel and never from the sphere
	// inside it. Otherwise measuring it would change the very size we are measuring.
	let boxH = 0;
	// The coordinate text under the sphere is always one 0.75rem line. The caption
	// can be one or two lines, so we measure it instead.
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
	<BlochSphere vector={overall} size={sphereSize} showAxisLabels={true} interactive={true} />
	<p
		bind:clientHeight={captionH}
		class="mt-1 max-w-[16rem] text-center text-[0.7rem] leading-tight text-muted"
	>
		{caption}
	</p>
</div>
