<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Icon from '@iconify/svelte';

	export let x: number;
	export let y: number;

	const dispatch = createEventDispatcher<{
		close: void;
		copy: void;
		reset: void;
	}>();
</script>

<div
	class="ctx-menu board-ctx-menu z-100"
	style="left: {x}px; top: {y}px;"
	role="menu"
	tabindex="0"
	on:click|stopPropagation={() => {}}
	on:keydown={(e) => { if (e.key === 'Escape') dispatch('close'); }}
>
	<button
		type="button"
		role="menuitem"
		class="ctx-menu-item rounded-t-sm"
		on:click={() => { dispatch('close'); dispatch('copy'); }}
	>
		<Icon icon="material-symbols:content-copy" width="16" height="16" />
		Copy Circuit
	</button>
	<button
		type="button"
		role="menuitem"
		class="ctx-menu-item-danger rounded-b-sm"
		on:click={() => dispatch('reset')}
	>
		<Icon icon="material-symbols:restart-alt" width="16" height="16" />
		Reset Circuit
	</button>
</div>
