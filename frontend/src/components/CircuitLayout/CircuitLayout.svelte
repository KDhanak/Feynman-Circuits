<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { circuitLayout } from '$lib/IR/stores';
	import WireDropeZone from './WireDropeZone.svelte';

	let containerEl: HTMLDivElement;
	let containerWidth = 0;

	const MAX_COLUMNS = 29;
	const LABEL_WIDTH = 80;
	const LEFT_EXTRA = 44;
	const BLOCH_SPACE = 90;

	const MIN_COLUMN_WIDTH = 44;
	const MAX_COLUMN_WIDTH = 72;

	function updateLayout() {
		containerWidth = containerEl?.clientWidth ?? 0;

		const usableWidth = Math.max(0, containerWidth - LABEL_WIDTH - LEFT_EXTRA - BLOCH_SPACE);

		const columnWidth = Math.max(
			MIN_COLUMN_WIDTH,
			Math.min(MAX_COLUMN_WIDTH, usableWidth / MAX_COLUMNS)
		);

		circuitLayout.set({
			columnWidth,
			gateOffset: LABEL_WIDTH + LEFT_EXTRA,
			usableWidth
		});
	}

	async function refreshLayout() {
		await tick();
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

<p class="sm:hidden text-center text-xs text-secondary-1 opacity-60 mb-2 px-4">
	Rotate your device or use a wider screen for the best circuit editing experience.
</p>
<div bind:this={containerEl} class="w-full flex justify-center overflow-x-auto">
	<WireDropeZone />
</div>
