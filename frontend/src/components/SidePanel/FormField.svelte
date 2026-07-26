<script lang="ts">
	export let id: string;
	export let label: string;
	export let type: string = 'text';
	export let placeholder: string = '';
	export let value: string = '';
	export let error: string | undefined = undefined;
	export let onInput: () => void = () => {};
</script>

<div>
	<label class="mb-1 block text-sm font-medium" style="color: var(--color-text);" for={id}>
		{label}
	</label>
	<input {id} {type} {placeholder} bind:value on:input={onInput} class="input-field" />
	{#if error}
		<p class="mt-1 text-sm font-bold text-red-500">{error}</p>
	{/if}
</div>
