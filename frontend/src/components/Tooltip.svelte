<script lang="ts">
    export let quick: string;
    export let detail: string = '';

    let visible = false;

    function toggle(e: MouseEvent) {
        e.stopPropagation(); // prevent the click bubbling to the gate drag logic
        visible = !visible;
    }

    function close() {
        visible = false;
    }
</script>

<svelte:window on:click={close} />

<div role="group" class="relative inline-flex">
    <slot />

    <!-- Info icon -->
    <button
        type="button"
        on:click={toggle}
        class="absolute -top-1.5 -right-1.5 z-10 flex items-center justify-center
               w-4 h-4 rounded-full text-ternary-1 border border-ternary-1 text-xs font-boldcursor-pointer leading-none bg-surface font-size: [9px];"
        aria-label="More info"
    >
        i
    </button>

    {#if visible}
        <div
            class="absolute z-200 w-80 rounded-md shadow-lg px-3 py-2 text-xs pointer-events-none bg-surface"
        >
            <p class="font-semibold mb-0.5 text-muted">{quick}</p>
            {#if detail}
                <p class="text-muted">{detail}</p>
            {/if}
        </div>
    {/if}
</div>
