<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { circuitLayout } from '$lib/stores/uiStores';
	import { isMobile } from '$lib/stores/isMobile';
	import WireDropeZone from './WireDropeZone.svelte';
	import { LABEL_WIDTH } from '$lib/utils/constants';

	let containerEl: HTMLDivElement;
	let containerWidth = 0;

	const MAX_COLUMNS = 29;
	const LEFT_EXTRA = 44;
	const BLOCH_SPACE = 90;

	const MIN_COLUMN_WIDTH = 44;
	// Tighter floor on mobile so gates sit closer together. Mobile gates are sized
	// to fit under this: controls h-8 (32px), SWAP w-7 (28px), letters ~28–30px.
	const MOBILE_MIN_COLUMN_WIDTH = 34;
	const MAX_COLUMN_WIDTH = 72;

	function updateLayout() {
		containerWidth = containerEl?.clientWidth ?? 0;

		// Per-qubit Bloch spheres are hidden on mobile, so reclaim that horizontal space.
		const blochSpace = $isMobile ? 0 : BLOCH_SPACE;
		// Halve the gap between the qubit label and the first gate on mobile.
		const leftExtra = $isMobile ? LEFT_EXTRA / 2 : LEFT_EXTRA;
		const usableWidth = Math.max(0, containerWidth - LABEL_WIDTH - leftExtra - blochSpace);

		const minColumnWidth = $isMobile ? MOBILE_MIN_COLUMN_WIDTH : MIN_COLUMN_WIDTH;
		const columnWidth = Math.max(
			minColumnWidth,
			Math.min(MAX_COLUMN_WIDTH, usableWidth / MAX_COLUMNS)
		);

		const gateOffset = LABEL_WIDTH + leftExtra;

		circuitLayout.set({
			columnWidth,
			gateOffset,
			usableWidth,
			totalWidth: gateOffset + MAX_COLUMNS * columnWidth
		});
	}

	async function refreshLayout() {
		await tick();
		updateLayout();
	}

	// Recompute column width when the mobile breakpoint flips — BLOCH_SPACE toggles
	// on/off, and the ResizeObserver alone won't catch a same-size breakpoint change.
	$: if (containerEl) {
		$isMobile;
		updateLayout();
	}

	onMount(() => {
		refreshLayout();

		const resizeObserver = new ResizeObserver(() => {
			updateLayout();
		});

		if (containerEl) resizeObserver.observe(containerEl);
		window.addEventListener('resize', updateLayout);

		return () => {
			resizeObserver.disconnect();
			window.removeEventListener('resize', updateLayout);
		};
	});
</script>

<div bind:this={containerEl} class="w-full h-full flex justify-center overflow-x-auto overflow-y-hidden">
	<WireDropeZone />
</div>
