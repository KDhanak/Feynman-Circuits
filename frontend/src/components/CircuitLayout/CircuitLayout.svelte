<script lang="ts">
	import WireDropeZone from './WireDropeZone.svelte';
</script>

<!-- Simple wrapper: centres the board and sets the outer scroll area.
     Column width and totalWidth are handled only by WireDropeZone,
     which fits the columns to the centre panel. -->
<div class="w-full h-full flex justify-center overflow-x-auto overflow-y-hidden">
	<WireDropeZone />
</div>
