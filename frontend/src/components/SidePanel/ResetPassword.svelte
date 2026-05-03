<script lang="ts">
	import { confirmPasswordReset } from '$lib/session';

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

	function normalizeBackendErrors(data: any): Record<string, string> {
		if (!data || typeof data !== 'object') return {};

		return Object.fromEntries(
			Object.entries(data).map(([key, value]) => [
				key,
				Array.isArray(value) ? String(value[0]) : String(value)
			])
		);
	}

	async function handleResetPassword() {
		generalErrorMsg = '';
		successMsg = '';
		resetPasswordErrors = {};
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
		<div>
			<label class="mb-1 block text-sm font-medium text-secondary-1" for="reset-password">
				New Password
			</label>
			<input
				id="reset-password"
				type="password"
				placeholder="At least 8 characters"
				bind:value={password}
				on:input={() => {
					const { password, detail, ...rest } = resetPasswordErrors;
					resetPasswordErrors = rest;
					generalErrorMsg = '';
					successMsg = '';
				}}
				class="input-field"
			/>
			{#if resetPasswordErrors.password}
				<p class="mt-1 text-sm font-bold text-red-400">{resetPasswordErrors.password}</p>
			{/if}
		</div>

		<div>
			<label class="mb-1 block text-sm font-medium text-secondary-1" for="reset-password2">
				Confirm Password
			</label>
			<input
				id="reset-password2"
				type="password"
				placeholder="Re-enter password"
				bind:value={password2}
				on:input={() => {
					const { password2, detail, ...rest } = resetPasswordErrors;
					resetPasswordErrors = rest;
					generalErrorMsg = '';
					successMsg = '';
				}}
				class="input-field"
			/>
			{#if resetPasswordErrors.password2}
				<p class="mt-1 text-sm font-bold text-red-400">{resetPasswordErrors.password2}</p>
			{/if}
		</div>

		<button
			type="submit"
			class="btn-primary w-full"
			disabled={loading}
		>
			{loading ? 'Resetting...' : 'Reset Password'}
		</button>

		{#if resetPasswordErrors.detail}
			<p class="mt-2 text-sm font-bold text-red-400">{resetPasswordErrors.detail}</p>
		{/if}

		{#if generalErrorMsg}
			<p class="mt-2 text-sm font-bold text-red-400">{generalErrorMsg}</p>
		{/if}

		{#if successMsg}
			<p class="mt-2 text-sm font-bold text-green-400">{successMsg}</p>
		{/if}
	</form>
</div>
