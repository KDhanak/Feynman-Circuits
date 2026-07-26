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
			// Allow underscore-prefixed identifiers to be intentionally unused
			// (e.g. `{#each list as _, i}`, destructured-and-dropped fields).
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
			],
			// These three target Svelte 5 *runes*-mode patterns. This codebase is
			// legacy mode (`export let` + `$:`), where they only produce false
			// positives: `new Map/Set` used via store.update()/reassignment is
			// correct (not a missed SvelteMap/SvelteSet), the BlochSphere `$:`
			// geometry stays reactive to the `size` prop on purpose, and the
			// `$: (deps, fn())` line is a deliberate dependency-tracking idiom.
			// Re-enable if/when components migrate to runes.
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
