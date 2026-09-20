<script lang="ts">
	import { signIn } from '$lib/auth/session';
	import { normalizeBackendErrors, extractResponseData, clearFields } from '$lib/utils/errorUtils';
	import { validateEmail, validateRequired } from '$lib/utils/formValidation';
	import FormField from './FormField.svelte';
	import Loader from '../Loader.svelte';

	export let initialEmail: string = '';
	export let onSignedIn: () => void = () => {};
	export let onSwitchToForgot: () => void = () => {};

	let signinEmail = initialEmail;
	let signinPassword = '';
	let successMsg = '';
	let loading = false;
	let generalErrorMsg = '';

	$: if (initialEmail) {
		signinEmail = initialEmail;
	}

	type SignInErrors = {
		email?: string;
		password?: string;
		detail?: string;
	};

	let signinErrors: SignInErrors = {};

	function clearError(...keys: (keyof SignInErrors)[]) {
		signinErrors = clearFields(signinErrors, keys);
		generalErrorMsg = '';
	}

	async function handleSignIn() {
		successMsg = '';
		generalErrorMsg = '';
		signinErrors = {};

		const emailError = validateEmail(signinEmail);
		const passwordError = validateRequired(signinPassword, 'Password');
		if (emailError || passwordError) {
			signinErrors = { email: emailError, password: passwordError };
			return;
		}

		loading = true;

		try {
			await signIn(signinEmail, signinPassword);
			successMsg = 'Signed in successfully!';
			setTimeout(() => {
				onSignedIn();
			}, 1000);
		} catch (err) {
			const data = extractResponseData(err);
			const errors = normalizeBackendErrors(data);

			signinErrors = {
				email: errors.email,
				password: errors.password,
				detail: errors.detail
			};

			if (!signinErrors.email && !signinErrors.password && !signinErrors.detail) {
				generalErrorMsg = 'Sign in failed';
			}
		} finally {
			loading = false;
		}
	}
</script>

<div>
	<form class="space-y-4" on:submit|preventDefault={handleSignIn}>
		<FormField
			id="signin-email"
			label="Email"
			type="email"
			placeholder="you@example.com"
			bind:value={signinEmail}
			error={signinErrors.email}
			onInput={() => clearError('email', 'detail')}
		/>

		<FormField
			id="signin-password"
			label="Password"
			type="password"
			placeholder="********"
			bind:value={signinPassword}
			error={signinErrors.password}
			onInput={() => clearError('password', 'detail')}
		/>

		<button
			type="submit"
			class="btn-primary flex w-full items-center justify-center gap-2"
			disabled={loading}
		>
			{#if loading}<Loader size={14} />{/if}
			{loading ? 'Signing in...' : 'Sign In'}
		</button>

		{#if signinErrors.detail}
			<p class="mt-2 text-sm font-bold text-red-500">{signinErrors.detail}</p>
		{/if}

		{#if generalErrorMsg}
			<p class="mt-2 text-sm font-bold text-red-500">{generalErrorMsg}</p>
		{/if}
		{#if successMsg}
			<p class="mt-2 text-sm font-bold text-green-500">{successMsg}</p>
		{/if}
	</form>

	<div>
		<p class="mt-4 text-sm" style="color: var(--color-text);">
			Forgot your password?
			<button
				type="button"
				class="font-bold cursor-pointer underline underline-offset-4"
				style="color: var(--color-ternary-1);"
				on:click={onSwitchToForgot}
			>
				Reset it
			</button>
		</p>
	</div>
</div>
