<script lang="ts">
	import { onMount } from 'svelte';
	import { circuitLayout, circuit } from '$lib/stores';
	import SingleWireDropZone from './SingleWireDropZone.svelte';
	import MultiWireDropZone from './MultiWireDropZone.svelte';

	let containerEl: HTMLDivElement;
	let containerWidth = 0;

	const MAX_COLUMNS = 29;
	const LABEL_WIDTH = 80;
	const LEFT_EXTRA = 44;
	const BLOCH_SPACE = 90;

	const MIN_COLUMN_WIDTH = 36;
	const MAX_COLUMN_WIDTH = 58;

	function updateLayout() {
		const usableWidth = Math.max(
			0,
			containerWidth - LABEL_WIDTH - LEFT_EXTRA - BLOCH_SPACE
		);

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

	onMount(() => {
		const update = () => {
			containerWidth = containerEl?.clientWidth ?? 0;
			updateLayout();
		};

		update();

		const resizeObserver = new ResizeObserver(update);
		if (containerEl) resizeObserver.observe(containerEl);

		window.addEventListener('resize', update);

		return () => {
			resizeObserver.disconnect();
			window.removeEventListener('resize', update);
		};
	});
</script>

<div bind:this={containerEl} class="w-full flex justify-center">
	{#if $circuit.mode === 'single'}
		<SingleWireDropZone qubit={0} />
	{:else}
		<MultiWireDropZone />
	{/if}
</div>
