<script lang="ts">
    export let message: string;
</script>

{#if message}
    <div class="error-display">
        <p class="error text-red-500">{message}</p>
    </div>
{/if}
