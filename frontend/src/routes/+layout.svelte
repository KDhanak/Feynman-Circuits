<script lang="ts">
	import '../app.css';
	import { theme } from '$lib/stores/themeStore';

	let { children } = $props();
</script>

{@render children()}
