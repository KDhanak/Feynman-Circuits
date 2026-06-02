<script lang="ts">
    import { onMount } from 'svelte';
    import { fly, fade } from 'svelte/transition';
    import Icon from '@iconify/svelte';
    import { listCircuits, loadCircuit, deleteCircuit, type CircuitSummary } from '$lib/api/circuitApi';
    import { circuitIR, currentCircuitId, currentCircuitName } from '$lib/IR/stores';
    import { triggerSimulation } from '$lib/circuit/dragDropUtils';
    import { markNameResolved } from '$lib/circuit/autoSave';
    import { showNotification } from '$lib/utils/notificationUtils';

    export let onClose: () => void;

    let circuits: CircuitSummary[] = [];
    let loading = true;
    let deletingId = '';
    let openMenuId = '';

    async function fetchCircuits() {
        try {
            circuits = await listCircuits();
        } catch {
            showNotification('Failed to load circuits.', 'error');
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        fetchCircuits();

        const handleClickOutside = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('.circuit-menu')) {
                openMenuId = '';
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    });

    async function openCircuit(circuit: CircuitSummary) {
        try {
            const ir = await loadCircuit(circuit.circuit_id);
            circuitIR.set(ir);
            currentCircuitId.set(circuit.circuit_id);
            currentCircuitName.set(circuit.name);
            markNameResolved();
            triggerSimulation(ir);
            showNotification(`"${circuit.name}" loaded.`, 'success');
            onClose();
        } catch {
            showNotification('Failed to load circuit.', 'error');
        }
    }

    function toggleMenu(circuit_id: string, event: MouseEvent) {
        event.stopPropagation();
        openMenuId = openMenuId === circuit_id ? '' : circuit_id;
    }

    async function handleDelete(circuit: CircuitSummary, event: MouseEvent) {
        event.stopPropagation();
        openMenuId = '';
        deletingId = circuit.circuit_id;
        try {
            await deleteCircuit(circuit.circuit_id);
            circuits = circuits.filter(c => c.circuit_id !== circuit.circuit_id);
            showNotification(`"${circuit.name}" deleted.`, 'success');
        } catch {
            showNotification('Failed to delete circuit.', 'error');
        } finally {
            deletingId = '';
        }
    }

    function formatDate(iso: string): string {
        return new Date(iso).toLocaleString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit'
        });
    }

    function handleBackdropClick(event: MouseEvent) {
        if (event.target === event.currentTarget) onClose();
    }
</script>

<div
    class="fixed inset-0 z-100"
    style="background-color: rgba(0,0,0,0.3); backdrop-filter: blur(4px);"
    role="button"
    tabindex="0"
    aria-label="Close circuits panel"
    on:click={handleBackdropClick}
    on:keydown={(e) => e.key === 'Escape' && onClose()}
    transition:fade={{ duration: 300 }}
>
    <aside
        class="absolute right-0 top-0 h-full w-full sm:max-w-md border-l border-t border-b rounded-sm shadow-2xl flex flex-col"
        style="background-color: var(--color-surface); border-color: var(--color-text);"
        transition:fly={{ x: 400, duration: 300 }}
    >
        <!-- Header -->
        <div
            class="flex items-center justify-between px-6 py-4 shrink-0"
            style="border-bottom: 1px solid var(--color-border);"
        >
            <h2 class="text-lg font-semibold" style="color: var(--color-text);">My Circuits</h2>
            <button type="button" aria-label="Close" on:click={onClose}>
                <Icon icon="material-symbols:close" class="cursor-pointer text-red-500" width="24" height="24" />
            </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto px-4 py-4">
            {#if loading}
                <div class="flex items-center justify-center h-40">
                    <Icon icon="svg-spinners:ring-resize" width="32" height="32" style="color: var(--color-measured);" />
                </div>

            {:else if circuits.length === 0}
                <div class="flex flex-col items-center justify-center h-40 gap-2">
                    <Icon icon="ph:circuit-board-bold" width="40" height="40" style="color: var(--color-muted);" />
                    <p class="text-sm" style="color: var(--color-muted);">No saved circuits yet.</p>
                </div>

            {:else}
                <ul class="flex flex-col gap-2">
                    {#each circuits as circuit (circuit.circuit_id)}
                        <li>
                            <div
                                class="w-full text-left px-4 py-3 rounded-sm shadow-sm shadow-measured/40 hover:shadow-measured transition-shadow duration-200 flex items-center justify-between gap-3 cursor-pointer"
                                style="background-color: var(--color-surface);"
                                role="button"
                                tabindex="0"
                                on:click={() => openCircuit(circuit)}
                                on:keydown={(e) => e.key === 'Enter' && openCircuit(circuit)}
                            >
                                <div class="flex flex-col gap-1 min-w-0">
                                    <div class="flex items-center gap-2 min-w-0">
                                        <span class="text-sm font-semibold truncate" style="color: var(--color-text);">
                                            {circuit.name}
                                        </span>
                                        {#if circuit.circuit_id === $currentCircuitId}
                                            <span class="shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                                                Active
                                            </span>
                                        {/if}
                                    </div>
                                    <span class="text-xs" style="color: var(--color-muted);">
                                        {formatDate(circuit.updated_at)}
                                    </span>
                                </div>

                                <!-- 3-dot menu -->
                                <div class="relative shrink-0 circuit-menu">
                                    <button
                                        class="p-1 rounded-sm hover:bg-measured/10 transition-colors duration-150 cursor-pointer"
                                        aria-label="Options for {circuit.name}"
                                        on:click={(e) => toggleMenu(circuit.circuit_id, e)}
                                    >
                                        {#if deletingId === circuit.circuit_id}
                                            <Icon icon="svg-spinners:ring-resize" width="18" height="18" style="color: var(--color-measured);" />
                                        {:else}
                                            <Icon icon="material-symbols:more-vert" width="18" height="18" style="color: var(--color-muted);" />
                                        {/if}
                                    </button>

                                    {#if openMenuId === circuit.circuit_id}
                                        <div
                                            transition:fly={{ y: -6, duration: 150 }}
                                            class="absolute right-0 top-full mt-1 w-32 rounded-sm shadow-sm shadow-measured z-10"
                                            style="background-color: var(--color-surface);"
                                        >
                                            <button
                                                class="btn-highlight-danger rounded-sm w-full text-left flex items-center gap-2"
                                                on:click={(e) => handleDelete(circuit, e)}
                                            >
                                                <Icon icon="material-symbols:delete-outline" width="16" height="16" />
                                                Delete
                                            </button>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        </li>
                    {/each}
                </ul>
            {/if}
        </div>
    </aside>
</div>
