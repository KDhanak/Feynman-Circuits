<script lang="ts">
	import { signUp } from '$lib/auth/session';
	import { normalizeBackendErrors, extractResponseData, clearFields } from '$lib/utils/errorUtils';
	import {
		validateEmail,
		validateRequired,
		validatePasswordLength,
		validatePasswordsMatch
	} from '$lib/utils/formValidation';
	import FormField from './FormField.svelte';

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

	function clearError(...keys: (keyof SignUpErrors)[]) {
		signupErrors = clearFields(signupErrors, keys);
	}

	async function handleSignUp() {
		generalErrorMsg = '';
		successMsg = '';
		signupErrors = {};

		const validationErrors: SignUpErrors = {
			first_name: validateRequired(firstName, 'First name'),
			last_name: validateRequired(lastName, 'Last name'),
			email: validateEmail(signupEmail),
			password: validatePasswordLength(signupPassword),
			password2: validatePasswordsMatch(signupPassword, signupPassword2)
		};

		if (Object.values(validationErrors).some((v) => v)) {
			signupErrors = validationErrors;
			return;
		}

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
		} catch (err) {
			const data = extractResponseData(err);
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
		<FormField
			id="signup-first-name"
			label="First Name"
			placeholder="First Name"
			bind:value={firstName}
			error={signupErrors.first_name}
			onInput={() => clearError('first_name')}
		/>
		<FormField
			id="signup-last-name"
			label="Last Name"
			placeholder="Last Name"
			bind:value={lastName}
			error={signupErrors.last_name}
			onInput={() => clearError('last_name')}
		/>
		<FormField
			id="signup-email"
			label="Email"
			type="email"
			placeholder="you@example.com"
			bind:value={signupEmail}
			error={signupErrors.email}
			onInput={() => clearError('email')}
		/>
		<FormField
			id="signup-password"
			label="Password"
			type="password"
			placeholder="At least 8 characters"
			bind:value={signupPassword}
			error={signupErrors.password}
			onInput={() => clearError('password')}
		/>
		<FormField
			id="signup-password2"
			label="Confirm Password"
			type="password"
			placeholder="At least 8 characters"
			bind:value={signupPassword2}
			error={signupErrors.password2}
			onInput={() => clearError('password2')}
		/>
		<button type="submit" class="btn-primary w-full">
			{loading ? 'Creating...' : 'Create Account'}
		</button>
		{#if signupErrors.non_field_errors}
			<p class="mt-2 text-sm text-red-500 font-bold">{signupErrors.non_field_errors}</p>
		{/if}
		{#if generalErrorMsg}
			<p class="mt-2 text-sm text-red-500 font-bold">{generalErrorMsg}</p>
		{/if}
		{#if successMsg}
			<p class="mt-2 text-sm text-green-500 font-bold">{successMsg}</p>
		{/if}
	</form>
</div>
