<script lang="ts">
	import BlochSphere from './BlochSphere.svelte';
	import { simulationResult } from '$lib/IR/stores';
	import { computeOverallBlochVector } from '$lib/quantum/bloch';

	$: vectors = $simulationResult.blochVectors ?? [];
	$: overall = computeOverallBlochVector(vectors);
	// One sphere can only hold one qubit's state, so for multi-qubit circuits
	// this is the mean of the per-qubit vectors — say so rather than implying
	// it is the state of the whole register.
	$: caption =
		vectors.length > 1
			? `Average over ${vectors.length} qubits — not the full ${vectors.length}-qubit state`
			: 'State of qubit 0';

	// The sphere is sized from the panel it sits in rather than from the window,
	// so it also grows when the results row is dragged taller. The wrapper is
	// h-full/w-full, meaning its box comes from the panel and never from the
	// sphere inside it — otherwise measuring it would feed back into the size
	// that determines it.
	let boxH = 0;
	// The coordinate readout under the sphere is one fixed 0.75rem line; the
	// caption wraps to one or two, so it is measured instead.
	const READOUT_H = 18;
	let captionH = 16;
	const MIN_SIZE = 120;
	const MAX_SIZE = 420;

	// Height only. The panel is an `auto` grid column, so its width is derived
	// from this sphere — feeding boxW back in would be circular and pin the
	// sphere at whatever size it first rendered. Height comes from the results
	// row, which is independent, so it is the safe axis to size from.
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
