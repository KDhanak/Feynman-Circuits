<script lang="ts">
	import { theme, type ThemePreference } from '$lib/stores/themeStore';
	import {
		settings,
		updateSettings,
		resetSettings,
		AUTO_SAVE_INTERVAL_OPTIONS,
		PROBABILITY_DECIMAL_OPTIONS,
		type ResultView
	} from '$lib/stores/settingsStore';
	import Icon from '@iconify/svelte';

	const themeOptions: { value: ThemePreference; label: string; icon: string }[] = [
		{ value: 'system', label: 'System', icon: 'ph:desktop-bold' },
		{ value: 'light', label: 'Light', icon: 'ph:sun-bold' },
		{ value: 'dark', label: 'Dark', icon: 'ph:moon-bold' }
	];

	const resultViewOptions: { value: ResultView; label: string; icon: string }[] = [
		{ value: 'list', label: 'List', icon: 'ph:list-bold' },
		{ value: 'histogram', label: 'Histogram', icon: 'ph:chart-bar-bold' }
	];
</script>

<div class="space-y-8">
	<!-- Appearance -->
	<section>
		<p class="mb-3 text-xs font-semibold uppercase tracking-widest" style="color: var(--color-muted, var(--color-text));">
			Appearance
		</p>

		<div class="mb-2 text-sm font-medium" style="color: var(--color-text);">Theme</div>
		<div class="grid grid-cols-3 gap-2">
			{#each themeOptions as opt}
				<button
					type="button"
					on:click={() => theme.set(opt.value)}
					class="flex flex-col items-center justify-center gap-1 rounded-sm border py-3 text-sm font-medium cursor-pointer transition-colors"
					style="border-color: {$theme === opt.value
						? 'var(--color-ternary-1)'
						: 'var(--color-border)'}; color: var(--color-text); background-color: {$theme === opt.value
						? 'color-mix(in srgb, var(--color-ternary-1) 12%, transparent)'
						: 'transparent'};"
				>
					<Icon icon={opt.icon} width="20" height="20" />
					{opt.label}
				</button>
			{/each}
		</div>
	</section>

	<div style="border-top: 1px solid var(--color-border);"></div>

	<!-- Editing -->
	<section>
		<p class="mb-3 text-xs font-semibold uppercase tracking-widest" style="color: var(--color-muted, var(--color-text));">
			Editing
		</p>

		<label class="flex items-center justify-between gap-4 cursor-pointer">
			<span>
				<span class="block text-sm font-medium" style="color: var(--color-text);">Auto-save</span>
				<span class="block text-xs" style="color: var(--color-muted);">
					Automatically save circuit changes while you work.
				</span>
			</span>
			<input
				type="checkbox"
				class="toggle"
				checked={$settings.autoSaveEnabled}
				on:change={(e) => updateSettings({ autoSaveEnabled: e.currentTarget.checked })}
			/>
		</label>

		{#if $settings.autoSaveEnabled}
			<div class="mt-4">
				<label class="mb-1 block text-sm font-medium" style="color: var(--color-text);" for="autosave-interval">
					Save every
				</label>
				<select
					id="autosave-interval"
					class="input-field"
					value={$settings.autoSaveIntervalMs}
					on:change={(e) => updateSettings({ autoSaveIntervalMs: Number(e.currentTarget.value) })}
				>
					{#each AUTO_SAVE_INTERVAL_OPTIONS as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>
		{/if}
	</section>

	<div style="border-top: 1px solid var(--color-border);"></div>

	<!-- Visualization -->
	<section>
		<p class="mb-3 text-xs font-semibold uppercase tracking-widest" style="color: var(--color-muted, var(--color-text));">
			Visualization
		</p>

		<div class="mb-2 text-sm font-medium" style="color: var(--color-text);">Default results view</div>
		<div class="grid grid-cols-2 gap-2">
			{#each resultViewOptions as opt}
				<button
					type="button"
					on:click={() => updateSettings({ defaultResultView: opt.value })}
					class="flex items-center justify-center gap-1.5 rounded-sm border py-2 text-sm font-medium cursor-pointer transition-colors"
					style="border-color: {$settings.defaultResultView === opt.value
						? 'var(--color-ternary-1)'
						: 'var(--color-border)'}; color: var(--color-text); background-color: {$settings.defaultResultView === opt.value
						? 'color-mix(in srgb, var(--color-ternary-1) 12%, transparent)'
						: 'transparent'};"
				>
					<Icon icon={opt.icon} width="18" height="18" />
					{opt.label}
				</button>
			{/each}
		</div>

		<div class="mt-4">
			<label class="mb-1 block text-sm font-medium" style="color: var(--color-text);" for="prob-decimals">
				Probability decimals
			</label>
			<select
				id="prob-decimals"
				class="input-field"
				value={$settings.probabilityDecimals}
				on:change={(e) => updateSettings({ probabilityDecimals: Number(e.currentTarget.value) })}
			>
				{#each PROBABILITY_DECIMAL_OPTIONS as d}
					<option value={d}>{d} decimal{d === 1 ? '' : 's'}</option>
				{/each}
			</select>
		</div>

		<label class="mt-4 flex items-center justify-between gap-4 cursor-pointer">
			<span>
				<span class="block text-sm font-medium" style="color: var(--color-text);">Show Bloch sphere</span>
				<span class="block text-xs" style="color: var(--color-muted);">
					Display the 3D Bloch sphere panel below the circuit.
				</span>
			</span>
			<input
				type="checkbox"
				class="toggle"
				checked={$settings.showBlochSphere}
				on:change={(e) => updateSettings({ showBlochSphere: e.currentTarget.checked })}
			/>
		</label>
	</section>

	<div style="border-top: 1px solid var(--color-border);"></div>

	<button
		type="button"
		class="text-sm font-medium underline underline-offset-4 cursor-pointer"
		style="color: var(--color-muted);"
		on:click={resetSettings}
	>
		Reset to defaults
	</button>
</div>

<style>
	.toggle {
		appearance: none;
		-webkit-appearance: none;
		position: relative;
		width: 2.5rem;
		height: 1.4rem;
		border-radius: 9999px;
		background-color: var(--color-border);
		cursor: pointer;
		flex-shrink: 0;
		transition: background-color 0.2s ease;
	}
	.toggle:checked {
		background-color: var(--color-ternary-1);
	}
	.toggle::after {
		content: '';
		position: absolute;
		top: 0.15rem;
		left: 0.15rem;
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 9999px;
		background-color: #fff;
		transition: transform 0.2s ease;
	}
	.toggle:checked::after {
		transform: translateX(1.1rem);
	}
</style>
