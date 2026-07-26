<script lang="ts">
	import { confirmPasswordReset } from '$lib/auth/session';
	import { normalizeBackendErrors, clearFields } from '$lib/utils/errorUtils';
	import { validatePasswordLength, validatePasswordsMatch } from '$lib/utils/formValidation';
	import FormField from './FormField.svelte';

	export let resetToken: string = '';
	export let onResetDone: () => void = () => {};

	let password = '';
	let password2 = '';
	let loading = false;
	let generalErrorMsg = '';
	let successMsg = '';

	type ResetPasswordErrors = {
		password?: string;
		password2?: string;
		detail?: string;
	};

	let resetPasswordErrors: ResetPasswordErrors = {};

	function clearError(...keys: (keyof ResetPasswordErrors)[]) {
		resetPasswordErrors = clearFields(resetPasswordErrors, keys);
		generalErrorMsg = '';
		successMsg = '';
	}

	async function handleResetPassword() {
		generalErrorMsg = '';
		successMsg = '';
		resetPasswordErrors = {};

		const validationErrors: ResetPasswordErrors = {
			password: validatePasswordLength(password),
			password2: validatePasswordsMatch(password, password2)
		};

		if (validationErrors.password || validationErrors.password2) {
			resetPasswordErrors = validationErrors;
			return;
		}

		loading = true;

		try {
			await confirmPasswordReset({
				reset_token: resetToken,
				password,
				password2
			});

			successMsg = 'Password reset successful.';

			setTimeout(() => {
				onResetDone();
			}, 1500);
		} catch (err: any) {
			const data = err?.response?.data;
			const errors = normalizeBackendErrors(data);

			resetPasswordErrors = {
				password: errors.password,
				password2: errors.password2,
				detail: errors.detail
			};

			if (
				!resetPasswordErrors.password &&
				!resetPasswordErrors.password2 &&
				!resetPasswordErrors.detail
			) {
				generalErrorMsg = 'Could not reset password.';
			}
		} finally {
			loading = false;
		}
	}
</script>

<div>
	<form class="space-y-4" on:submit|preventDefault={handleResetPassword}>
		<FormField
			id="reset-password"
			label="New Password"
			type="password"
			placeholder="At least 8 characters"
			bind:value={password}
			error={resetPasswordErrors.password}
			onInput={() => clearError('password', 'detail')}
		/>

		<FormField
			id="reset-password2"
			label="Confirm Password"
			type="password"
			placeholder="Re-enter password"
			bind:value={password2}
			error={resetPasswordErrors.password2}
			onInput={() => clearError('password2', 'detail')}
		/>

		<button type="submit" class="btn-primary w-full" disabled={loading}>
			{loading ? 'Resetting...' : 'Reset Password'}
		</button>

		{#if resetPasswordErrors.detail}
			<p class="mt-2 text-sm font-bold text-red-500">{resetPasswordErrors.detail}</p>
		{/if}

		{#if generalErrorMsg}
			<p class="mt-2 text-sm font-bold text-red-500">{generalErrorMsg}</p>
		{/if}

		{#if successMsg}
			<p class="mt-2 text-sm font-bold text-green-500">{successMsg}</p>
		{/if}
	</form>
</div>
