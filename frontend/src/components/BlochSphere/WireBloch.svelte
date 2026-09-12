<script lang="ts">
	import BlochSphere from './BlochSphere.svelte';
	import { simulationResult } from '$lib/IR/stores';

	export let qubit: number;

	// One sphere per qubit, centred on that qubit's wire. The size is limited by
	// the distance between two wires next to each other, not by the row height:
	// the columns in WireDropeZone are `h-14` rows with `gap-1` between them, so
	// the wires are 60px apart, and anything drawn bigger than that touches its
	// neighbour.
	//
	// Worked out from these numbers instead of picked by eye, so it is clear what
	// to update if the row height or the gap changes.
	const ROW_HEIGHT = 68; // set by hand (an h-14 row is 56px)
	const ROW_GAP = 4; // gap-1
	const PITCH = ROW_HEIGHT + ROW_GAP; // 72px, wire centre to wire centre
	const GUTTER = 10; // space between spheres next to each other
	const SIZE = PITCH - GUTTER; // 62px

	$: fallback = { qubit, x: 0, y: 0, z: 1, magnitude: 1 };
	$: vector = $simulationResult.blochVectors?.find((v) => v.qubit === qubit) ?? fallback;
</script>

<div class="pointer-events-none">
	<BlochSphere {vector} size={SIZE} showDetails={false} />
</div>
