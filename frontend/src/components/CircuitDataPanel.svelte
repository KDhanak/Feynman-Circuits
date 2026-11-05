<script lang="ts">
	import Icon from '@iconify/svelte';
	import Loader from './Loader.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
	import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
	import { circuitIR, currentCircuitName } from '$lib/IR/stores';
	import {
		buildCanonicalString,
		buildQASMString,
		buildQiskitString,
		buildQSharpString,
		type DataViewMode,
		type OpenQasmVersion
	} from '$lib/circuit/circuitDataModal';
	import {
		copyToClipboard,
		downloadCircuit,
		downloadCircuitAsOpenQasm,
		downloadCircuitAsQiskit,
		downloadCircuitAsQSharp,
		importJson,
		importOpenQasm,
		importQiskit,
		importQSharp
	} from '$lib/circuit/circuitActions';
	import { resolvedTheme } from '$lib/stores/themeStore';
	import { settings, updateSettings } from '$lib/stores/settingsStore';

	let monaco: typeof import('monaco-editor');

	let monacoEnvironmentConfigured = false;
	function configureMonacoEnvironment() {
		if (monacoEnvironmentConfigured) return;
		monacoEnvironmentConfigured = true;
		self.MonacoEnvironment = {
			getWorker(_workerId: string, label: string) {
				if (label === 'json') return new jsonWorker();
				return new editorWorker();
			}
		};
	}

	let monacoRegistered = false;
	function registerMonaco(monacoInstance: typeof import('monaco-editor')) {
		if (monacoRegistered) return;
		monacoRegistered = true;

		monacoInstance.languages.register({ id: 'openqasm' });
		monacoInstance.languages.setMonarchTokensProvider('openqasm', {
			keywords: [
				'OPENQASM',
				'include',
				'gate',
				'opaque',
				'measure',
				'reset',
				'barrier',
				'qreg',
				'creg',
				'if',
				'qubit',
				'bit',
				'int',
				'uint',
				'float',
				'angle',
				'bool',
				'complex',
				'def',
				'let',
				'input',
				'output',
				'const',
				'extern',
				'for',
				'while',
				'break',
				'continue',
				'return',
				'box',
				'if',
				'else',
				'switch',
				'case',
				'default',
				'cx',
				'u',
				'p',
				'x',
				'y',
				'z',
				'h',
				's',
				't',
				'sx',
				'rx',
				'ry',
				'rz',
				'cz',
				'ccx',
				'swap',
				'cswap'
			],
			typeKeywords: [],
			operators: [
				'+',
				'-',
				'*',
				'/',
				'=',
				'==',
				'!=',
				'<',
				'>',
				'<=',
				'>=',
				'(',
				')',
				'[',
				']',
				'{',
				'}',
				',',
				';'
			],
			symbols: /[+\-*/%=!<>()[\]{},;]/,
			escapes: /\\(?:[abfnrtv"\\]|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8})/,
			tokenizer: {
				root: [
					[/\/\/.*$/, 'comment'],
					[/"(?:\\.|[^"\\])*"/, 'string'],
					[/\d+\.?\d*/, 'number'],
					[/[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
					[/@symbols/, 'operator'],
					[/\s+/, 'whitespace']
				]
			}
		});

		// Light theme built from the app's palette (see app.css @theme): violet
		// accent for keywords, teal strings, orange numbers, slate keys. Covers both
		// the OpenQASM tokens (keyword/string/number/…) and JSON tokens (*.json).
		monacoInstance.editor.defineTheme('feynman-light', {
			base: 'vs',
			inherit: true,
			rules: [
				{ token: 'keyword', foreground: '6d28d9' }, // accent
				{ token: 'keyword.json', foreground: '6d28d9' }, // true / false / null
				{ token: 'string', foreground: '0f766e' }, // teal
				{ token: 'string.key.json', foreground: '334155' }, // property names
				{ token: 'string.value.json', foreground: '0f766e' },
				{ token: 'number', foreground: 'c2410c' }, // measured
				{ token: 'comment', foreground: '94a3b8' }, // slate/muted
				{ token: 'operator', foreground: '0f172a' }, // text
				{ token: 'identifier', foreground: '0f172a' }
			],
			colors: {
				'editor.background': '#ffffff',
				'editor.foreground': '#0f172a',
				'editorLineNumber.foreground': '#cbd5e1',
				'editorLineNumber.activeForeground': '#475569',
				'editorCursor.foreground': '#6d28d9',
				'editor.selectionBackground': '#ede9fe', // secondary-1
				'editor.lineHighlightBackground': '#0f172a08',
				'editorGutter.background': '#ffffff',
				'editorIndentGuide.background': '#e2e8f0' // border
			}
		});

		// Dark theme — matches the dark panel surface, so the editor sits flush in
		// its panel instead of as a separate grey box.
		monacoInstance.editor.defineTheme('feynman-dark', {
			base: 'vs-dark',
			inherit: true,
			rules: [
				{ token: 'keyword', foreground: 'c4b5fd' },
				{ token: 'keyword.json', foreground: 'c4b5fd' },
				{ token: 'string', foreground: '5eead4' },
				{ token: 'string.key.json', foreground: 'a3acbd' },
				{ token: 'string.value.json', foreground: '5eead4' },
				{ token: 'number', foreground: 'fdba74' },
				{ token: 'comment', foreground: '64748b' },
				{ token: 'operator', foreground: 'e6e8ee' },
				{ token: 'identifier', foreground: 'e6e8ee' }
			],
			colors: {
				'editor.background': '#12151c', // surface (dark)
				'editor.foreground': '#e6e8ee',
				'editorGutter.background': '#12151c',
				'editorLineNumber.foreground': '#3c4559',
				'editorLineNumber.activeForeground': '#a3acbd',
				'editor.lineHighlightBackground': '#ffffff08',
				'editorCursor.foreground': '#c4b5fd', // branding (dark)
				'editor.selectionBackground': '#2e1065' // accent tint
			}
		});
	}

	let activeView: DataViewMode = 'cir';
	let qasmVersion: OpenQasmVersion = '3.0';
	let showVersionMenu = false;

	// When the panel itself is narrow (≤490px, e.g. in a slim left column, or on a
	// small screen), the side-by-side view buttons don't fit next to the action
	// icons, so they turn into a hamburger dropdown. We measure the panel's own
	// width (not the screen's) with ResizeObserver. The threshold went up with the
	// Q# button: one more view button needs one more button's worth of room.
	const NARROW_THRESHOLD = 490;
	let isNarrow = false;
	let showViewMenu = false;
	let viewMenuContainer: HTMLDivElement;
	let panelEl: HTMLDivElement;

	$: currentViewLabel =
		activeView === 'qasm'
			? `OpenQASM ${qasmVersion}`
			: activeView === 'qiskit'
				? 'Qiskit'
				: activeView === 'qsharp'
					? 'Q#'
					: 'Canonical IR';

	let container: HTMLDivElement;
	let editor: import('monaco-editor').editor.IStandaloneCodeEditor | null = null;
	let monacoPromise: Promise<typeof import('monaco-editor') | null> | null = null;
	// Monaco is big and loads in the background, so show a spinner over the editor until it is ready.
	let editorReady = false;

	// Follow the app theme so the editor changes style right away when the theme is
	// switched (the panel is always on the page, so checking once at the start isn't enough).
	$: isDarkMode = $resolvedTheme === 'dark';
	const editorTheme = (dark: boolean) => (dark ? 'feynman-dark' : 'feynman-light');

	// Apply the theme again whenever the app theme changes.
	$: if (editor && monaco) monaco.editor.setTheme(editorTheme(isDarkMode));

	// Live view: the editor text is rebuilt from the circuit whenever the circuit,
	// the open tab, or the QASM version changes. Edits you type are only a draft.
	// They change the circuit only when you click Import, and they are replaced the
	// next time the circuit itself changes (e.g. dragging a gate).
	$: derived =
		activeView === 'qasm'
			? buildQASMString($circuitIR, qasmVersion)
			: activeView === 'qiskit'
				? buildQiskitString($circuitIR)
				: activeView === 'qsharp'
					? buildQSharpString($circuitIR)
					: buildCanonicalString($circuitIR);

	// Monaco ships a Q# grammar of its own, so unlike 'openqasm' this one needs
	// no registering.
	const editorLanguage = (view: DataViewMode) =>
		view === 'qasm'
			? 'openqasm'
			: view === 'qiskit'
				? 'python'
				: view === 'qsharp'
					? 'qsharp'
					: 'json';

	// Put the generated text into the editor. `editor` is listed as a dependency so
	// the first update runs once the editor is ready.
	$: syncEditor(derived, editor);

	if (typeof window !== 'undefined') {
		configureMonacoEnvironment();
		monacoPromise = import('monaco-editor').catch(() => null);
	}

	onMount(() => {
		const savedView = localStorage.getItem('circuitDataView') as DataViewMode | null;
		if (
			savedView === 'cir' ||
			savedView === 'qasm' ||
			savedView === 'qiskit' ||
			savedView === 'qsharp'
		)
			activeView = savedView;
		initializeEditor();
	});

	onMount(() => {
		if (!panelEl || typeof ResizeObserver === 'undefined') return;
		const ro = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? panelEl.clientWidth;
			const narrow = width <= NARROW_THRESHOLD;
			if (narrow === isNarrow) return;
			isNarrow = narrow;
			if (!narrow) showViewMenu = false;
		});
		ro.observe(panelEl);
		return () => ro.disconnect();
	});

	function handleWindowClick(e: MouseEvent) {
		if (showViewMenu && viewMenuContainer && !viewMenuContainer.contains(e.target as Node)) {
			showViewMenu = false;
		}
	}

	onDestroy(() => {
		editor?.dispose();
		editor = null;
	});

	async function initializeEditor() {
		monaco = (await monacoPromise) ?? (await import('monaco-editor'));
		if (!container) return;

		registerMonaco(monaco);

		editor = monaco.editor.create(container, {
			value: derived,
			language: editorLanguage(activeView),
			theme: editorTheme(isDarkMode),
			readOnly: false,
			automaticLayout: true,
			minimap: { enabled: false },
			fontSize: 12,
			fontFamily: "'Courier New', monospace",
			lineNumbers: 'on',
			scrollBeyondLastLine: false,
			wordWrap: 'off',
			tabSize: 2
		});

		editorReady = true;
	}

	function syncEditor(text: string, ed: typeof editor) {
		if (!ed || !monaco) return;
		const newLanguage = editorLanguage(activeView);
		const model = ed.getModel();
		if (model && model.getLanguageId() !== newLanguage) {
			monaco.editor.setModelLanguage(model, newLanguage);
		}
		if (ed.getValue() !== text) ed.setValue(text);
	}

	function selectView(mode: DataViewMode) {
		activeView = mode;
		localStorage.setItem('circuitDataView', mode);
	}

	$: dockedLeft = $settings.codePanelPosition === 'left';
	function toggleDock() {
		updateSettings({ codePanelPosition: dockedLeft ? 'bottom' : 'left' });
	}

	function selectViewFromMenu(mode: DataViewMode) {
		selectView(mode);
		showViewMenu = false;
	}

	function selectQasmFromMenu(version: OpenQasmVersion) {
		selectView('qasm');
		qasmVersion = version;
		showViewMenu = false;
	}

	function selectVersion(version: OpenQasmVersion) {
		qasmVersion = version;
		showVersionMenu = false;
	}

	function handleCopy() {
		copyToClipboard(editor?.getValue() ?? derived);
	}

	function handleDownload() {
		if (activeView === 'qasm') {
			downloadCircuitAsOpenQasm($currentCircuitName, $circuitIR, qasmVersion);
		} else if (activeView === 'qiskit') {
			downloadCircuitAsQiskit($currentCircuitName, $circuitIR);
		} else if (activeView === 'qsharp') {
			downloadCircuitAsQSharp($currentCircuitName, $circuitIR);
		} else {
			downloadCircuit($currentCircuitName, $circuitIR);
		}
	}

	function handleImport() {
		const text = editor?.getValue() ?? '';
		if (activeView === 'qasm') {
			importOpenQasm(text);
		} else if (activeView === 'qiskit') {
			importQiskit(text);
		} else if (activeView === 'qsharp') {
			importQSharp(text);
		} else {
			importJson(text);
		}
	}
</script>

<svelte:window on:click={handleWindowClick} />

<div bind:this={panelEl} class="flex h-full flex-col" style="color: var(--color-text);">
	<!-- Toolbar -->
	<div class="mb-2 flex items-center justify-between gap-2">
		{#if isNarrow}
			<!-- Collapsed view selector: hamburger dropdown for ≤1300px -->
			<div class="relative inline-flex" bind:this={viewMenuContainer}>
				<button
					type="button"
					on:click={() => (showViewMenu = !showViewMenu)}
					aria-haspopup="menu"
					aria-expanded={showViewMenu}
					class="btn-quiet !text-xs !px-2.5 !py-1"
				>
					<Icon icon="ph:list-bold" width="16" height="16" />
					<span>{currentViewLabel}</span>
				</button>

				{#if showViewMenu}
					<div
						class="absolute left-0 top-full z-50 mt-1 flex min-w-full flex-col whitespace-nowrap rounded-sm shadow-sm"
						style="background-color: var(--color-surface);"
						role="menu"
						tabindex="-1"
						transition:fade={{ duration: 150 }}
					>
						<button
							type="button"
							role="menuitem"
							on:click={() => selectViewFromMenu('cir')}
							class="btn-highlight-item w-full rounded-t-sm"
							class:opacity-100={activeView === 'cir'}
							class:opacity-75={activeView !== 'cir'}
						>
							Canonical IR
						</button>
						<button
							type="button"
							role="menuitem"
							on:click={() => selectQasmFromMenu('3.0')}
							class="btn-highlight-item w-full"
							class:opacity-100={activeView === 'qasm' && qasmVersion === '3.0'}
							class:opacity-75={!(activeView === 'qasm' && qasmVersion === '3.0')}
						>
							OpenQASM 3.0
						</button>
						<button
							type="button"
							role="menuitem"
							on:click={() => selectQasmFromMenu('2.0')}
							class="btn-highlight-item w-full"
							class:opacity-100={activeView === 'qasm' && qasmVersion === '2.0'}
							class:opacity-75={!(activeView === 'qasm' && qasmVersion === '2.0')}
						>
							OpenQASM 2.0
						</button>
						<button
							type="button"
							role="menuitem"
							on:click={() => selectViewFromMenu('qiskit')}
							class="btn-highlight-item w-full"
							class:opacity-100={activeView === 'qiskit'}
							class:opacity-75={activeView !== 'qiskit'}
						>
							Qiskit
						</button>
						<button
							type="button"
							role="menuitem"
							on:click={() => selectViewFromMenu('qsharp')}
							class="btn-highlight-item w-full rounded-b-sm"
							class:opacity-100={activeView === 'qsharp'}
							class:opacity-75={activeView !== 'qsharp'}
						>
							Q#
						</button>
					</div>
				{/if}
			</div>
		{:else}
			<div class="seg-group flex items-center gap-0.5 rounded-lg p-0.5">
				<button
					type="button"
					on:click={() => selectView('cir')}
					class:seg-active={activeView === 'cir'}
					class="seg-tab rounded-md px-2.5 py-1 text-xs cursor-pointer"
				>
					Canonical IR
				</button>
				<div class="relative inline-flex">
					<button
						type="button"
						on:click={() => selectView('qasm')}
						class:seg-active={activeView === 'qasm'}
						class="seg-tab rounded-l-md px-2.5 py-1 text-xs cursor-pointer"
					>
						OpenQASM {qasmVersion}
					</button>
					<button
						type="button"
						on:click={() => (showVersionMenu = !showVersionMenu)}
						disabled={activeView !== 'qasm'}
						class:seg-active={activeView === 'qasm'}
						class="seg-tab rounded-r-md px-1.5 py-1 text-[10px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
					>
						<span class="inline-block transition-transform" class:rotate-180={showVersionMenu}
							>▼</span
						>
					</button>

					{#if activeView === 'qasm' && showVersionMenu}
						<div
							class="absolute left-0 right-0 top-full z-50 mt-1 rounded-sm shadow-sm"
							style="background-color: var(--color-surface);"
							role="menu"
							tabindex="-1"
							transition:fade={{ duration: 150 }}
						>
							<button
								type="button"
								role="menuitem"
								on:click={() => selectVersion('3.0')}
								class="btn-highlight-item w-full rounded-t-sm"
								class:opacity-100={qasmVersion === '3.0'}
								class:opacity-75={qasmVersion !== '3.0'}
							>
								OpenQASM 3.0
							</button>
							<button
								type="button"
								role="menuitem"
								on:click={() => selectVersion('2.0')}
								class="btn-highlight-item w-full rounded-b-sm"
								class:opacity-100={qasmVersion === '2.0'}
								class:opacity-75={qasmVersion !== '2.0'}
							>
								OpenQASM 2.0
							</button>
						</div>
					{/if}
				</div>
				<button
					type="button"
					on:click={() => selectView('qiskit')}
					class:seg-active={activeView === 'qiskit'}
					class="seg-tab rounded-md px-2.5 py-1 text-xs cursor-pointer"
				>
					Qiskit
				</button>
				<button
					type="button"
					on:click={() => selectView('qsharp')}
					class:seg-active={activeView === 'qsharp'}
					class="seg-tab rounded-md px-2.5 py-1 text-xs cursor-pointer"
				>
					Q#
				</button>
			</div>
		{/if}

		<div class="flex items-center gap-2">
			<!-- Dock toggle: only useful on wide screens where the left panel fits -->
			<button
				type="button"
				on:click={toggleDock}
				class="hidden lg:inline-flex"
				aria-label={dockedLeft ? 'Move code panel to bottom' : 'Move code panel to left'}
				title={dockedLeft ? 'Dock to bottom' : 'Dock to left'}
			>
				<Icon
					icon={dockedLeft ? 'mdi:dock-bottom' : 'mdi:dock-left'}
					width="20"
					height="20"
					class="cursor-pointer transition-colors hover:text-text active:text-accent"
				/>
			</button>
			<button type="button" on:click={handleCopy} aria-label="Copy" title="Copy">
				<Icon
					icon="solar:copy-bold"
					width="20"
					height="20"
					class="cursor-pointer transition-colors hover:text-text active:text-accent"
				/>
			</button>
			<button type="button" on:click={handleDownload} aria-label="Download" title="Download">
				<Icon
					icon="mingcute:download-fill"
					width="20"
					height="20"
					class="cursor-pointer transition-colors hover:text-text active:text-accent"
				/>
			</button>
			<button
				type="button"
				on:click={handleImport}
				aria-label="Import"
				title="Apply edits to circuit"
			>
				<Icon
					icon="flowbite:file-import-solid"
					width="20"
					height="20"
					class="cursor-pointer transition-colors hover:text-text active:text-accent"
				/>
			</button>
		</div>
	</div>

	<!-- Editor -->
	<div
		class="relative min-h-0 flex-1"
		style="border: 1px solid var(--color-border); border-radius: 0.375rem; overflow: hidden;"
	>
		<div bind:this={container} class="absolute inset-0"></div>
		{#if !editorReady}
			<div
				class="absolute inset-0 flex flex-col items-center justify-center gap-2"
				style="background: var(--color-background);"
				out:fade={{ duration: 200 }}
			>
				<span style="color: var(--color-measured);"><Loader size="md" /></span>
				<span class="text-xs" style="color: var(--color-muted);">Loading editor…</span>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Segmented tab control: one quiet track, the active tab lifts out of it. */
	.seg-group {
		background: var(--color-surface-2);
		border: 1px solid var(--color-border);
	}
	.seg-tab {
		color: var(--color-muted);
		background: transparent;
		border: 1px solid transparent;
		font-weight: 500;
		transition:
			color 0.1s ease,
			background-color 0.1s ease;
	}
	.seg-tab:hover:not(:disabled) {
		color: var(--color-text);
	}
	.seg-tab.seg-active {
		color: var(--color-text);
		background: var(--color-surface);
		border-color: var(--color-border);
		box-shadow: 0 1px 2px rgb(15 23 42 / 0.06);
	}
	:global(html.dark) .seg-tab.seg-active {
		background: color-mix(in srgb, var(--color-accent) 22%, var(--color-surface));
		border-color: color-mix(in srgb, var(--color-accent) 40%, transparent);
	}
	:global(.monaco-editor) {
		font-family: 'Courier New', monospace !important;
	}
	:global(.monaco-editor .overflow-guard) {
		border-radius: 0.125rem;
	}
	:global(.monaco-editor .monaco-editor-background) {
		background-color: var(--color-background) !important;
	}
</style>
