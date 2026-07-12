<script lang="ts">
	import WireDropeZone from './WireDropeZone.svelte';
</script>

<!-- Thin wrapper: centres the board and provides the outer scroll bounds.
     Column-width / totalWidth geometry is owned entirely by WireDropeZone,
     which fits the columns to the centre panel. -->
<div class="w-full h-full flex justify-center overflow-x-auto overflow-y-hidden">
	<WireDropeZone />
</div>
