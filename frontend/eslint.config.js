import prettier from 'eslint-config-prettier';
import js from '@eslint/js';
import { includeIgnoreFile } from '@eslint/compat';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = fileURLToPath(new URL('../.gitignore', import.meta.url));

export default ts.config(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			'no-undef': 'off',
			// Allow names that start with an underscore to be unused on purpose
			// (e.g. `{#each list as _, i}`, or fields we take out of an object and ignore).
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
			],
			// These three rules are for Svelte 5 *runes* mode. This codebase uses the
			// older mode (`export let` + `$:`), where these rules only give false
			// warnings: `new Map/Set` used with store.update() or reassignment is
			// correct (we did not forget SvelteMap/SvelteSet), the BlochSphere `$:`
			// sizes update when the `size` prop changes on purpose, and the
			// `$: (deps, fn())` line is a known trick to re-run code when deps change.
			// Turn them back on if the components move to runes.
			'svelte/prefer-svelte-reactivity': 'off',
			'svelte/no-immutable-reactive-statements': 'off',
			'@typescript-eslint/no-unused-expressions': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	}
);
