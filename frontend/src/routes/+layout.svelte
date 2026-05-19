<script lang="ts">
	import '../app.css';
	import { theme } from '$lib/themeStore';

	let { children } = $props();
</script>

{@render children()}
