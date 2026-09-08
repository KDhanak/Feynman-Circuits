<script lang="ts">
	import BlochSphere from './BlochSphere.svelte';
	import { simulationResult } from '$lib/IR/stores';

	export let qubit: number;

	// One sphere per qubit, centred on that qubit's wire. What bounds the size is
	// the distance between consecutive wires, not the row height: the columns in
	// WireDropeZone are `h-14` rows separated by `gap-1`, so wires sit 60px apart
	// and anything drawn larger than that touches its neighbour.
	//
	// Derived rather than picked by eye, so the dependency is visible if either
	// the row height or the gap changes.
	const ROW_HEIGHT = 68; // h-14
	const ROW_GAP = 4; // gap-1
	const PITCH = ROW_HEIGHT + ROW_GAP; // 60px, wire centre to wire centre
	const GUTTER = 10; // clear space between neighbouring spheres
	const SIZE = PITCH - GUTTER; // 50px

	$: fallback = { qubit, x: 0, y: 0, z: 1, magnitude: 1 };
	$: vector = $simulationResult.blochVectors?.find((v) => v.qubit === qubit) ?? fallback;
</script>

<div class="pointer-events-none">
	<BlochSphere {vector} size={SIZE} showDetails={false} />
</div>
