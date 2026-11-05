<script lang="ts">
	// Draws a matrix in square brackets. Used by the gate tooltips and by the
	// step-by-step view (where a state vector is a matrix with one column).
	//
	// Entries are plain text. Write a power as e^{iθ}: the part inside the braces
	// is shown as a superscript.
	export let rows: string[][];
	// A number written in front of the brackets, e.g. 1/√2 for H.
	export let scale: string | undefined = undefined;
	// Text shown to the left of each row, outside the brackets, e.g. "|01⟩".
	export let rowLabels: string[] | undefined = undefined;
	// Entries to show in a strong colour, as "row,col" keys.
	export let highlight: Set<string> | undefined = undefined;
	// 'sm' is the tooltip size, 'md' is for the step-by-step view.
	export let size: 'sm' | 'md' = 'sm';

	$: font = size === 'sm' ? 'text-[10px]' : 'text-[11px]';
	$: supFont = size === 'sm' ? 'text-[8px]' : 'text-[9px]';
	$: rowGap = size === 'sm' ? 'gap-y-0.5' : 'gap-y-1';

	// Splits "e^{iθ}" into the plain part and the superscript part.
	function splitPower(entry: string): { base: string; power: string } {
		const m = entry.match(/^(.*)\^\{(.*)\}$/);
		return m ? { base: m[1], power: m[2] } : { base: entry, power: '' };
	}
</script>

<div class="flex items-center gap-1 w-max">
	{#if rowLabels}
		<!-- Same font, line height and row gap as the matrix, so each label lines up with its row. -->
		<div class="grid {rowGap} py-0.5 {font} leading-none whitespace-nowrap opacity-70">
			{#each rowLabels as label, r (r)}
				<span>{label}</span>
			{/each}
		</div>
	{/if}
	{#if scale}
		<span class="{font} whitespace-nowrap">{scale}</span>
	{/if}
	<div
		class="matrix grid gap-x-2 {rowGap} px-1.5 {font} leading-none whitespace-nowrap"
		style:grid-template-columns="repeat({rows[0]?.length ?? 1}, auto)"
	>
		{#each rows as row, r (r)}
			{#each row as entry, c (c)}
				{@const { base, power } = splitPower(entry)}
				<span
					class="text-center"
					class:font-semibold={highlight?.has(`${r},${c}`)}
					style:color={highlight?.has(`${r},${c}`) ? 'var(--color-probability)' : undefined}
					>{base}{#if power}<sup class={supFont}>{power}</sup>{/if}</span
				>
			{/each}
		{/each}
	</div>
</div>

<style>
	/* Square brackets drawn with borders, so they always match the matrix height. */
	.matrix {
		border-left: 1px solid currentColor;
		border-right: 1px solid currentColor;
		padding-top: 2px;
		padding-bottom: 2px;
		background:
			linear-gradient(currentColor, currentColor) top left / 4px 1px no-repeat,
			linear-gradient(currentColor, currentColor) bottom left / 4px 1px no-repeat,
			linear-gradient(currentColor, currentColor) top right / 4px 1px no-repeat,
			linear-gradient(currentColor, currentColor) bottom right / 4px 1px no-repeat;
	}
</style>
