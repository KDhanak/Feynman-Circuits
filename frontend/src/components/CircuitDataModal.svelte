<script lang="ts">
	import Icon from '@iconify/svelte';
	import type { DataViewMode, OpenQasmVersion } from '$lib/circuit/circuitDataModal';
	import { fade, scale } from 'svelte/transition';
	import { tick } from 'svelte';
	import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
	import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';

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

	let qasmSupportRegistered = false;
	function registerOpenQasmSupport(monacoInstance: typeof import('monaco-editor'), isDark: boolean) {
		if (qasmSupportRegistered) return;
		qasmSupportRegistered = true;

		// Define OpenQASM language (supports both 2.0 and 3.0)
		monacoInstance.languages.register({ id: 'openqasm' });
		monacoInstance.languages.setMonarchTokensProvider('openqasm', {
			keywords: [
				// OpenQASM 2.0 & 3.0 common
				'OPENQASM', 'include', 'gate', 'opaque', 'measure', 'reset', 'barrier',
				// OpenQASM 2.0
				'qreg', 'creg', 'if',
				// OpenQASM 3.0
				'qubit', 'bit', 'int', 'uint', 'float', 'angle', 'bool', 'complex',
				'def', 'let', 'input', 'output', 'const', 'extern',
				'for', 'while', 'break', 'continue', 'return', 'box',
				'if', 'else', 'switch', 'case', 'default',
				// Gate names
				'cx', 'u', 'p', 'x', 'y', 'z', 'h', 's', 't', 'sx', 'rx', 'ry', 'rz', 'cz', 'ccx', 'swap', 'cswap'
			],
			typeKeywords: [],
			operators: ['+', '-', '*', '/', '=', '==', '!=', '<', '>', '<=', '>=', '(', ')', '[', ']', '{', '}', ',', ';'],
			symbols: /[+\-*/%=!<>()[\]{},;]/,
			escapes: /\\(?:[abfnrtv"\\]|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8})/,
			tokenizer: {
				root: [
					[/\/\/.*$/, 'comment'],
					[/"(?:\\.|[^"\\])*"/, 'string'],
					[/\d+\.?\d*/, 'number'],
					[/[a-zA-Z_]\w*/, {
						cases: {
							'@keywords': 'keyword',
							'@default': 'identifier'
						}
					}],
					[/@symbols/, 'operator'],
					[/\s+/, 'whitespace'],
				]
			}
		});

		// Define OpenQASM theme colors
		const themeToUse = isDark ? 'vs-dark' : 'vs';
		monacoInstance.editor.defineTheme('openqasm-theme', {
			base: themeToUse,
			inherit: true,
			rules: [
				{ token: 'keyword', foreground: isDark ? '569cd6' : '0000ff' },
				{ token: 'string', foreground: isDark ? 'ce9178' : 'a31515' },
				{ token: 'comment', foreground: isDark ? '6a9955' : '008000' },
				{ token: 'number', foreground: isDark ? 'b5cea8' : '098658' },
				{ token: 'operator', foreground: isDark ? 'd4d4d4' : '000000' },
			],
			colors: {
				'editor.background': isDark ? '#1e1e1e' : '#ffffff',
				'editor.foreground': isDark ? '#d4d4d4' : '#000000',
			}
		});
	}

	export let open = false;
	export let activeView: DataViewMode = 'cir';
	export let value = '';
	export let qasmVersion: OpenQasmVersion = '3.0';

	export let onClose: () => void;
	export let onTabChange: (mode: DataViewMode) => void;
	export let onVersionChange: (version: OpenQasmVersion) => void;
	export let onCopy: () => void;
	export let onDownload: () => void;
	export let onImport: () => void;

	let showVersionMenu = false;
	let editor: any = null;
	let monacoPromise: Promise<any> | null = null;
	let isDarkMode = true;
	let isInitializing = false;

	// Pre-load Monaco in the background
	if (typeof window !== 'undefined') {
		configureMonacoEnvironment();
		monacoPromise = import('monaco-editor').catch(() => null);
	}

	function handleQasmClick() {
		onTabChange('qasm');
	}

	function toggleVersionMenu() {
		showVersionMenu = !showVersionMenu;
	}

	$: if (open && !editor && !isInitializing) {
		isInitializing = true;
		// Wait for Svelte to render the container DOM before mounting Monaco into it
		tick().then(() => initializeMonaco());
	}

	$: if (!open && editor) {
		// Dispose editor when modal closes
		editor.dispose();
		editor = null;
	}

	function handleVersionSelect(version: OpenQasmVersion) {
		qasmVersion = version;
		onVersionChange(version);
		showVersionMenu = false;
	}

	function focusOnMount(node: HTMLElement) {
		node.focus();
		return {
			destroy() {}
		};
	}

	async function initializeMonaco() {
		// Query for the editor container div by id
		const container = document.getElementById('monaco-editor-container') as HTMLDivElement;

		if (!container) {
			isInitializing = false;
			return;
		}

		// Use pre-loaded Monaco or import if not ready
		monaco = await monacoPromise;
		if (!monaco) {
			monaco = await import('monaco-editor');
		}

		// The modal may have been closed while Monaco was still loading — bail out
		// instead of mounting an editor instance that nothing will ever dispose.
		if (!open) {
			isInitializing = false;
			return;
		}

		// Detect if dark mode is active based on background color luminance
		const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim();

		// Convert hex to RGB and calculate luminance
		if (bgColor.startsWith('#')) {
			const hex = bgColor.substring(1);
			const r = parseInt(hex.substring(0, 2), 16);
			const g = parseInt(hex.substring(2, 4), 16);
			const b = parseInt(hex.substring(4, 6), 16);
			const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
			isDarkMode = luminance < 0.5;
		}

		registerOpenQasmSupport(monaco, isDarkMode);

		const themeToUse = isDarkMode ? 'vs-dark' : 'vs';

		// Create editor
		const editorTheme = activeView === 'qasm' ? 'openqasm-theme' : themeToUse;
		editor = monaco.editor.create(container, {
			value: value || '',
			language: activeView === 'qasm' ? 'openqasm' : 'json',
			theme: editorTheme,
			readOnly: false,
			automaticLayout: true,
			minimap: { enabled: false },
			fontSize: 13,
			fontFamily: "'Courier New', monospace",
			lineNumbers: 'on',
			scrollBeyondLastLine: false,
			wordWrap: 'off',
			tabSize: 2,
		});

		// Force Monaco to recalculate layout
		setTimeout(() => {
			editor.layout();
		}, 100);

		// Update parent value on editor change
		editor.onDidChangeModelContent(() => {
			value = editor?.getValue() || '';
		});

		isInitializing = false;
	}

	// Update editor language and content when activeView changes
	$: if (editor && open) {
		const newLanguage = activeView === 'qasm' ? 'openqasm' : 'json';
		const currentLanguage = editor.getModel()?.getLanguageId();

		if (currentLanguage !== newLanguage) {
			monaco.editor.setModelLanguage(editor.getModel()!, newLanguage);
			// Change theme when switching to/from OpenQASM
			const newTheme = newLanguage === 'openqasm' ? 'openqasm-theme' : (isDarkMode ? 'vs-dark' : 'vs');
			monaco.editor.setTheme(newTheme);
		}

		const currentValue = editor.getValue();
		if (value !== currentValue) {
			editor.setValue(value);
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 flex items-center justify-center z-60"
		role="button"
		transition:fade={{ duration: 200 }}
		tabindex="0"
		aria-label="Close circuit data modal"
		on:click={onClose}
		on:keydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') onClose();
		}}
	>
		<div
			class="backdrop-blur-2xl p-4 rounded-sm shadow-sm shadow-ternary-3 max-w-4xl w-[95vw] sm:w-full max-h-[85vh] flex flex-col"
			style="background-color: var(--color-surface);"
			role="dialog"
			aria-modal="true"
			tabindex="0"
			transition:scale={{ duration: 200, start: 0.8 }}
			use:focusOnMount
			on:click={(e) => {
				const target = e.target as HTMLElement;
				if (showVersionMenu && !target.closest('.relative.inline-flex')) {
					showVersionMenu = false;
				}
				e.stopPropagation();
			}}
			on:keydown={(e) => {
				if (e.key === 'Escape') onClose();
			}}
		>
			<div class="flex items-center justify-between mb-3">
				<div class="flex items-center gap-2">
					<button
						type="button"
						on:click={() => onTabChange('cir')}
						class:!bg-ternary-2={activeView === 'cir'}
						class:!text-white={activeView === 'cir'}
						class:!border-ternary-2={activeView === 'cir'}
						class="rounded-sm px-3 py-1.5 text-sm border border-secondary-2 bg-white text-secondary-2 cursor-pointer"
					>
						Canonical IR
					</button>
					<div class="relative inline-flex">
						<button
							type="button"
							on:click={handleQasmClick}
							class:!bg-ternary-2={activeView === 'qasm'}
							class:!text-white={activeView === 'qasm'}
							class:!border-ternary-2={activeView === 'qasm'}
							class="rounded-l-sm px-3 py-1.5 text-sm border border-secondary-2 bg-white text-secondary-2 cursor-pointer flex-1"
						>
							OpenQASM {qasmVersion}
						</button>
						<button
							type="button"
							on:click={toggleVersionMenu}
							disabled={activeView !== 'qasm'}
							class:!bg-ternary-2={activeView === 'qasm'}
							class:!text-white={activeView === 'qasm'}
							class:!border-l-white={activeView === 'qasm'}
							class="rounded-r-sm px-2 py-1.5 text-sm border-l border-secondary-2 bg-white text-secondary-2 cursor-pointer hover:bg-secondary-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							<span class="transition-transform inline-block" class:rotate-180={showVersionMenu}>▼</span>
						</button>

						{#if activeView === 'qasm' && showVersionMenu}
							<div
								class="absolute top-full mt-1 left-0 right-0 rounded-sm z-50 shadow-sm"
								style="background-color: var(--color-surface);"
								role="menu"
								tabindex="-1"
								transition:fade={{ duration: 150 }}
								on:keydown={(e) => {
									if (e.key === 'Escape') {
										showVersionMenu = false;
										e.preventDefault();
									}
								}}
							>
								<button
									type="button"
									role="menuitem"
									on:click={() => handleVersionSelect('3.0')}
									class="btn-highlight-item rounded-t-sm w-full"
									class:opacity-100={qasmVersion === '3.0'}
									class:opacity-75={qasmVersion !== '3.0'}
								>
									OpenQASM 3.0
								</button>
								<button
									type="button"
									role="menuitem"
									on:click={() => handleVersionSelect('2.0')}
									class="btn-highlight-item rounded-b-sm w-full"
									class:opacity-100={qasmVersion === '2.0'}
									class:opacity-75={qasmVersion !== '2.0'}
								>
									OpenQASM 2.0
								</button>
							</div>
						{/if}
					</div>
				</div>

				<div class="flex items-center gap-2" style="color: var(--color-text)">
					<div class="flex flex-col justify-center items-center">
						<button type="button" on:click={onCopy} class="rounded-sm text-sm">
							<Icon
								icon="solar:copy-bold"
								width="24"
								height="24"
								class="active:text-green-400 cursor-pointer"
							/>
						</button>
						<span class="font-medium text-[11px]">Copy</span>
					</div>
					<div class="flex flex-col justify-center items-center">
						<button type="button" on:click={onDownload} class="rounded-sm text-sm">
							<Icon
								icon="mingcute:download-fill"
								width="24"
								height="24"
								class="active:text-green-400 cursor-pointer"
							/>
						</button>
						<span class="font-medium text-[11px]">Download</span>
					</div>
					<div class="flex flex-col">
						<button type="button" on:click={onImport} class="rounded-sm text-sm">
							<Icon
								icon="mdi:file-import"
								width="24"
								height="24"
								class="active:text-green-400 cursor-pointer"
							/>
						</button>
						<span class="font-medium text-[11px]">Import</span>
					</div>
					<button type="button" aria-label="Close dialog" on:click={onClose} class="mb-3">
						<Icon
							icon="material-symbols:close"
							class="text-red-500 cursor-pointer"
							width="28"
							height="28"
						/>
					</button>
				</div>
			</div>

			<div
				id="monaco-editor-container"
				style="
					width: 100%;
					height: calc(100vh - 200px);
					max-height: 60vh;
					border: 1px solid var(--color-border);
					border-radius: 0.125rem;
					overflow: hidden;
				"
			></div>
		</div>
	</div>
{/if}

<style>
	:global(.monaco-editor) {
		font-family: 'Courier New', monospace !important;
		height: 100% !important;
		width: 100% !important;
	}

	:global(.monaco-editor .overflow-guard) {
		border-radius: 0.125rem;
	}

	:global(.monaco-editor .monaco-scrollable-element) {
		height: 100%;
	}

	:global(.monaco-editor .monaco-editor-background) {
		background-color: var(--color-background) !important;
	}
</style>
