<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { loadSession } from '$lib/session';

	let { children } = $props();
	
	onMount(() => {
		loadSession();
	});
</script>

{@render children()}
