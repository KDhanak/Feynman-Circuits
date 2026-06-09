<script lang="ts">
	import { requestPasswordReset } from '$lib/auth/session';

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

	async function handlePasswordReset() {
        successMsg = '';
		generalErrorMsg = '';
		resetErrors = {};
		loading = true;

		try {
			await requestPasswordReset(resetEmail);
			successMsg ='If an account exists for this email, an OTP has been sent.';
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

	function normalizeBackendErrors(data: any): Record<string, string> {
		if (!data || typeof data !== 'object') return {};

		return Object.fromEntries(
			Object.entries(data).map(([key, value]) => [
				key,
				Array.isArray(value) ? String(value[0]) : String(value)
			])
		);
	}
</script>

<div>
	<form class="space-y-4" on:submit|preventDefault={handlePasswordReset}>
		<div>
			<label class="mb-1 block text-sm font-medium" style="color: var(--color-text);" for="reset-email">
				Email
			</label>
			<input
				id="reset-email"
				type="email"
				placeholder="you@example.com"
				bind:value={resetEmail}
				on:input={() => {
					const { email, detail, ...rest } = resetErrors;
					resetErrors = rest;
					generalErrorMsg = '';
					successMsg = '';
				}}
				class="input-field"
			/>

			{#if resetErrors.email}
				<p class="mt-1 text-sm text-red-500 font-bold">{resetErrors.email}</p>
			{/if}
		</div>

		<button
			type="submit"
			class="btn-primary w-full"
			disabled={loading}
		>
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
