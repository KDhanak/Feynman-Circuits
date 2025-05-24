<script lang="ts">
    export let message: string;
	import Icon from '@iconify/svelte';
</script>

{#if message}
    <div class="error-display flex space-x-2">
        <Icon icon="mdi:alert" class="error font-bold text-ternary-1" width="24" height="24" />
        <p class="error font-bold text-md text-ternary-1">{message}</p>
    </div>
{/if}
