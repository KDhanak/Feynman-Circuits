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
			<label class="mb-1 block text-sm font-medium text-secondary-1" for="signin-email">
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
				class="w-full rounded-sm border border-secondary-2 bg-white px-3 py-2 text-black font-extralight outline-none focus:border-secondary-3"
			/>
			{#if signinErrors.email}
				<p class="mt-1 text-sm text-red-400 font-bold">{signinErrors.email}</p>
			{/if}
		</div>

		<div>
			<label class="mb-1 block text-sm font-medium text-secondary-1" for="signin-password">
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
				class="w-full rounded-sm border border-secondary-2 bg-white px-3 py-2 text-black font-extralight outline-none focus:border-secondary-3"
			/>
			{#if signinErrors.password}
				<p class="mt-1 text-sm text-red-400 font-bold">{signinErrors.password}</p>
			{/if}
		</div>

		<button
			type="submit"
			class="w-full cursor-pointer rounded-sm border px-4 py-2 font-semibold bg-ternary-2 text-white active:bg-ternary-2 border-white active:text-ternary-3 active:border-ternary-3"
			disabled={loading}
		>
			{loading ? 'Signing in...' : 'Sign In'}
		</button>

		{#if signinErrors.detail}
			<p class="mt-2 text-sm text-red-400 font-bold">{signinErrors.detail}</p>
		{/if}

		{#if generalErrorMsg}
			<p class="mt-2 text-sm text-red-400 font-bold">{generalErrorMsg}</p>
		{/if}
		{#if successMsg}
			<p class="mt-2 text-sm text-green-400 font-bold">{successMsg}</p>
		{/if}
	</form>

	<div>
		<p class="mt-4 text-sm text-secondary-1">
			Forgot your password?
			<button
				type="button"
				class="text-ternary-1 font-bold active:text-ternary-3 cursor-pointer underline underline-offset-4"
				on:click={onSwitchToForgot}
			>
				Reset it
			</button>
		</p>
	</div>
</div>
