<script lang="ts">
	import { signUp } from '$lib/session';

    export let onSignedUp: (email: string) => void = () => {};

	let generalErrorMsg = '';
	let successMsg = '';
	let loading = false;
	let firstName = '';
	let lastName = '';
	let signupEmail = '';
	let signupPassword = '';
	let signupPassword2 = '';

	type SignUpErrors = {
		first_name?: string;
		last_name?: string;
		email?: string;
		password?: string;
		password2?: string;
		non_field_errors?: string;
	};

	let signupErrors: SignUpErrors = {};

	function normalizeBackendErrors(data: any): Record<string, string> {
		if (!data || typeof data !== 'object') return {};

		return Object.fromEntries(
			Object.entries(data).map(([key, value]) => [
				key,
				Array.isArray(value) ? String(value[0]) : String(value)
			])
		);
	}

	async function handleSignUp() {
		generalErrorMsg = '';
		successMsg = '';
		signupErrors = {};
		loading = true;

		try {
			await signUp({
				email: signupEmail,
				first_name: firstName,
				last_name: lastName,
				password: signupPassword,
				password2: signupPassword2
			});
			successMsg = 'Account created. You can sign in now.';
            setTimeout(() => {
                onSignedUp(signupEmail);
            }, 1000);
			signupPassword = '';
			signupPassword2 = '';
			signupErrors = {};
		} catch (err: any) {
			const data = err?.response?.data;
			const errors = normalizeBackendErrors(data);

			signupErrors = {
				first_name: errors.first_name,
				last_name: errors.last_name,
				email: errors.email,
				password: errors.password,
				password2: errors.password2,
				non_field_errors: errors.non_field_errors
			};

			if (
				!signupErrors.first_name &&
				!signupErrors.last_name &&
				!signupErrors.email &&
				!signupErrors.password &&
				!signupErrors.password2 &&
				!signupErrors.non_field_errors
			) {
				generalErrorMsg = 'Sign up failed';
			}
		} finally {
			loading = false;
		}
	}
</script>

<div>
	<form class="space-y-4" on:submit|preventDefault={handleSignUp}>
		<div>
			<label class="mb-1 block text-sm font-medium text-secondary-1" for="signup-first-name"
				>First Name</label
			>
			<input
				id="signup-first-name"
				type="text"
				placeholder="First Name"
				bind:value={firstName}
				on:input={() => {
					const { first_name, ...rest } = signupErrors;
					signupErrors = rest;
				}}
				class="input-field"
			/>
			{#if signupErrors.first_name}
				<p class="mt-1 text-sm text-red-400 font-bold">{signupErrors.first_name}</p>
			{/if}
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-secondary-1" for="signup-last-name"
				>Last Name</label
			>
			<input
				id="signup-last-name"
				type="text"
				placeholder="Last Name"
				bind:value={lastName}
				on:input={() => {
					const { last_name, ...rest } = signupErrors;
					signupErrors = rest;
				}}
				class="input-field"
			/>
			{#if signupErrors.last_name}
				<p class="mt-1 text-sm text-red-400 font-bold">{signupErrors.last_name}</p>
			{/if}
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-secondary-1" for="signup-email">Email</label
			>
			<input
				id="signup-email"
				type="email"
				placeholder="you@example.com"
				bind:value={signupEmail}
				on:input={() => {
					const { email, ...rest } = signupErrors;
					signupErrors = rest;
				}}
				class="input-field"
			/>
			{#if signupErrors.email}
				<p class="mt-1 text-sm text-red-400 font-bold">{signupErrors.email}</p>
			{/if}
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-secondary-1" for="signup-password"
				>Password</label
			>
			<input
				id="signup-password"
				type="password"
				placeholder="At least 8 characters"
				bind:value={signupPassword}
				on:input={() => {
					const { password, ...rest } = signupErrors;
					signupErrors = rest;
				}}
				class="input-field"
			/>
			{#if signupErrors.password}
				<p class="mt-1 text-sm text-red-400 font-bold">{signupErrors.password}</p>
			{/if}
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-secondary-1" for="signup-password2"
				>Confirm Password</label
			>
			<input
				id="signup-password2"
				type="password"
				placeholder="At least 8 characters"
				bind:value={signupPassword2}
				on:input={() => {
					const { password2, ...rest } = signupErrors;
					signupErrors = rest;
				}}
				class="input-field"
			/>
			{#if signupErrors.password2}
				<p class="mt-1 text-sm text-red-400 font-bold">{signupErrors.password2}</p>
			{/if}
		</div>
		<button
			type="submit"
			class="btn-primary w-full"
		>
			{loading ? 'Creating...' : 'Create Account'}
		</button>
		{#if signupErrors.non_field_errors}
			<p class="mt-2 text-sm text-red-400 font-bold">{signupErrors.non_field_errors}</p>
		{/if}
		{#if generalErrorMsg}
			<p class="mt-2 text-sm text-red-400 font-bold">{generalErrorMsg}</p>
		{/if}
		{#if successMsg}
			<p class="mt-2 text-sm text-green-400 font-bold">{successMsg}</p>
		{/if}
	</form>
</div>
