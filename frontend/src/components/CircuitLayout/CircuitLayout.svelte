<script lang="ts">
	import WireDropeZone from './WireDropeZone.svelte';
</script>

<!-- Simple wrapper: centres the board and sets the outer scroll area.
     Column width and totalWidth are handled only by WireDropeZone,
     which fits the columns to the centre panel.

     `flex-1 min-h-0` makes this fill the whole panel, even when there are only
     one or two wires. The board inside is `h-full`, and a percentage height
     needs a parent with a real height to measure against. Without it the board
     was only as tall as its wires, so the circuit name and the undo/redo
     buttons pinned to its bottom edge floated up in the middle of the panel and
     moved down every time a qubit was added. -->
<div class="w-full flex-1 min-h-0 flex justify-center overflow-x-auto overflow-y-hidden">
	<WireDropeZone />
</div>
