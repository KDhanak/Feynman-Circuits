<script lang="ts">
	import { requestPasswordReset } from '$lib/session';

    export let onOtpSent: (email: string) => void = () => {};

	let resetEmail = '';
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
			<label class="mb-1 block text-sm font-medium text-secondary-1" for="reset-email">
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
				class="w-full rounded-sm border border-secondary-2 bg-white px-3 py-2 text-black font-extralight outline-none focus:border-secondary-3"
			/>

			{#if resetErrors.email}
				<p class="mt-1 text-sm text-red-400 font-bold">{resetErrors.email}</p>
			{/if}
		</div>

		<button
			type="submit"
			class="w-full cursor-pointer rounded-sm border px-4 py-2 font-semibold bg-ternary-2 text-white active:bg-ternary-2 border-white active:text-ternary-3 active:border-ternary-3"
			disabled={loading}
		>
			{loading ? 'Sending OTP...' : 'Send OTP'}
		</button>

		{#if resetErrors.detail}
			<p class="mt-2 text-sm text-red-400 font-bold">{resetErrors.detail}</p>
		{/if}

		{#if generalErrorMsg}
			<p class="mt-2 text-sm text-red-400 font-bold">{generalErrorMsg}</p>
		{/if}

		{#if successMsg}
			<p class="mt-2 text-sm text-green-400 font-bold">{successMsg}</p>
		{/if}
	</form>
</div>
