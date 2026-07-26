<script lang="ts">
	import { requestPasswordReset } from '$lib/auth/session';
	import { normalizeBackendErrors, clearFields } from '$lib/utils/errorUtils';
	import { validateEmail } from '$lib/utils/formValidation';
	import FormField from './FormField.svelte';

	export let initialEmail: string = '';
	export let onOtpSent: (email: string) => void = () => {};

	let resetEmail = initialEmail;
	let loading = false;
	let generalErrorMsg = '';
	let successMsg = '';

	type ResetRequestErrors = {
		email?: string;
		detail?: string;
	};

	let resetErrors: ResetRequestErrors = {};

	function clearError(...keys: (keyof ResetRequestErrors)[]) {
		resetErrors = clearFields(resetErrors, keys);
		generalErrorMsg = '';
		successMsg = '';
	}

	async function handlePasswordReset() {
		successMsg = '';
		generalErrorMsg = '';
		resetErrors = {};

		const emailError = validateEmail(resetEmail);
		if (emailError) {
			resetErrors = { email: emailError };
			return;
		}

		loading = true;

		try {
			await requestPasswordReset(resetEmail);
			successMsg = 'If an account exists for this email, an OTP has been sent.';
			setTimeout(() => {
				onOtpSent(resetEmail);
			}, 1500);
		} catch (err: any) {
			const data = err?.response?.data;
			const errors = normalizeBackendErrors(data);

			resetErrors = {
				email: errors.email,
				detail: errors.detail
			};

			if (!resetErrors.email && !resetErrors.detail) {
				generalErrorMsg = 'Could not send password reset OTP.';
			}
		} finally {
			loading = false;
		}
	}
</script>

<div>
	<form class="space-y-4" on:submit|preventDefault={handlePasswordReset}>
		<FormField
			id="reset-email"
			label="Email"
			type="email"
			placeholder="you@example.com"
			bind:value={resetEmail}
			error={resetErrors.email}
			onInput={() => clearError('email', 'detail')}
		/>

		<button type="submit" class="btn-primary w-full" disabled={loading}>
			{loading ? 'Sending OTP...' : 'Send OTP'}
		</button>

		{#if resetErrors.detail}
			<p class="mt-2 text-sm text-red-500 font-bold">{resetErrors.detail}</p>
		{/if}

		{#if generalErrorMsg}
			<p class="mt-2 text-sm text-red-500 font-bold">{generalErrorMsg}</p>
		{/if}

		{#if successMsg}
			<p class="mt-2 text-sm text-green-500 font-bold">{successMsg}</p>
		{/if}
	</form>
</div>
