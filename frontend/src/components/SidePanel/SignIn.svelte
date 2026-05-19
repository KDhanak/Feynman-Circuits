<script lang="ts">
	import { signIn } from '$lib/session';

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

	function normalizeBackendErrors(data: any): Record<string, string> {
		if (!data || typeof data !== 'object') return {};

		return Object.fromEntries(
			Object.entries(data).map(([key, value]) => [
				key,
				Array.isArray(value) ? String(value[0]) : String(value)
			])
		);
	}

	async function handleSignIn() {
		successMsg = '';
		generalErrorMsg = '';
		signinErrors = {};
		loading = true;

		try {
			await signIn(signinEmail, signinPassword);
			successMsg = 'Signed in successfully!';
			setTimeout(() => {
				onSignedIn();
			}, 1000);
		} catch (err: any) {
			const data = err?.response?.data;
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
		<div>
			<label class="mb-1 block text-sm font-medium" style="color: var(--color-text);" for="signin-email">
				Email
			</label>
			<input
				id="signin-email"
				type="email"
				placeholder="you@example.com"
				bind:value={signinEmail}
				on:input={() => {
					const { email, detail, ...rest } = signinErrors;
					signinErrors = rest;
					generalErrorMsg = '';
				}}
				class="input-field"
			/>
			{#if signinErrors.email}
				<p class="mt-1 text-sm font-bold text-red-500">{signinErrors.email}</p>
			{/if}
		</div>

		<div>
			<label class="mb-1 block text-sm font-medium" style="color: var(--color-text);" for="signin-password">
				Password
			</label>
			<input
				id="signin-password"
				type="password"
				placeholder="********"
				bind:value={signinPassword}
				on:input={() => {
					const { password, detail, ...rest } = signinErrors;
					signinErrors = rest;
					generalErrorMsg = '';
				}}
				class="input-field"
			/>
			{#if signinErrors.password}
				<p class="mt-1 text-sm font-bold text-red-500">{signinErrors.password}</p>
			{/if}
		</div>

		<button
			type="submit"
			class="btn-primary w-full"
			disabled={loading}
		>
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
