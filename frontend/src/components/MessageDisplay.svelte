<script lang="ts">
    export let message: string;
	import Icon from '@iconify/svelte';
</script>

{#if message}
    <div class="message-display flex space-x-2">
        <Icon icon="icon-park-solid:doc-success" class="message font-bold text-success-1" width="24" height="24" />
        <p class="message font-bold text-md text-success-1">{message}</p>
    </div>
{/if}
