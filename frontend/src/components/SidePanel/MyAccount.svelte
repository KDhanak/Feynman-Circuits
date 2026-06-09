<script lang="ts">
	import { session, updateProfile, changePassword } from '$lib/auth/session';

	export let onResetPassword: () => void = () => {};

	// ── Edit Profile ──────────────────────────────────────────────────
	let firstName = $session.user?.first_name ?? '';
	let lastName = $session.user?.last_name ?? '';
	let profileLoading = false;
	let profileSuccessMsg = '';
	let profileGeneralError = '';

	type ProfileErrors = { first_name?: string; last_name?: string; detail?: string };
	let profileErrors: ProfileErrors = {};

	// ── Change Password ───────────────────────────────────────────────
	let currentPassword = '';
	let newPassword = '';
	let newPassword2 = '';
	let passwordLoading = false;
	let passwordSuccessMsg = '';
	let passwordGeneralError = '';

	type PasswordErrors = {
		current_password?: string;
		password?: string;
		password2?: string;
		detail?: string;
	};
	let passwordErrors: PasswordErrors = {};

	function normalizeBackendErrors(data: any): Record<string, string> {
		if (!data || typeof data !== 'object') return {};
		return Object.fromEntries(
			Object.entries(data).map(([key, value]) => [
				key,
				Array.isArray(value) ? String(value[0]) : String(value)
			])
		);
	}

	async function handleUpdateProfile() {
		profileSuccessMsg = '';
		profileGeneralError = '';
		profileErrors = {};
		profileLoading = true;

		try {
			await updateProfile({ first_name: firstName.trim(), last_name: lastName.trim() });
			profileSuccessMsg = 'Profile updated!';
		} catch (err: any) {
			const errors = normalizeBackendErrors(err?.response?.data);
			profileErrors = { first_name: errors.first_name, last_name: errors.last_name, detail: errors.detail };
			if (!profileErrors.first_name && !profileErrors.last_name && !profileErrors.detail) {
				profileGeneralError = 'Could not update profile.';
			}
		} finally {
			profileLoading = false;
		}
	}

	async function handleChangePassword() {
		passwordSuccessMsg = '';
		passwordGeneralError = '';
		passwordErrors = {};
		passwordLoading = true;

		try {
			await changePassword({ current_password: currentPassword, password: newPassword, password2: newPassword2 });
			passwordSuccessMsg = 'Password changed successfully!';
			currentPassword = '';
			newPassword = '';
			newPassword2 = '';
		} catch (err: any) {
			const errors = normalizeBackendErrors(err?.response?.data);
			passwordErrors = {
				current_password: errors.current_password,
				password: errors.password,
				password2: errors.password2,
				detail: errors.detail
			};
			if (!passwordErrors.current_password && !passwordErrors.password && !passwordErrors.password2 && !passwordErrors.detail) {
				passwordGeneralError = 'Could not change password.';
			}
		} finally {
			passwordLoading = false;
		}
	}
</script>

<div class="space-y-8">
	<!-- Profile Info -->
	<section>
		<div class="mb-4">
			<p class="text-xs font-semibold uppercase tracking-widest" style="color: var(--color-text-muted, var(--color-text));">
				Account
			</p>
			<p class="mt-1 text-sm" style="color: var(--color-text);">{$session.user?.email}</p>
		</div>

		<form class="space-y-4" on:submit|preventDefault={handleUpdateProfile}>
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="mb-1 block text-sm font-medium" style="color: var(--color-text);" for="account-first-name">
						First Name
					</label>
					<input
						id="account-first-name"
						type="text"
						bind:value={firstName}
						on:input={() => { const { first_name, detail, ...rest } = profileErrors; profileErrors = rest; profileSuccessMsg = ''; profileGeneralError = ''; }}
						class="input-field"
					/>
					{#if profileErrors.first_name}
						<p class="mt-1 text-sm font-bold text-red-500">{profileErrors.first_name}</p>
					{/if}
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium" style="color: var(--color-text);" for="account-last-name">
						Last Name
					</label>
					<input
						id="account-last-name"
						type="text"
						bind:value={lastName}
						on:input={() => { const { last_name, detail, ...rest } = profileErrors; profileErrors = rest; profileSuccessMsg = ''; profileGeneralError = ''; }}
						class="input-field"
					/>
					{#if profileErrors.last_name}
						<p class="mt-1 text-sm font-bold text-red-500">{profileErrors.last_name}</p>
					{/if}
				</div>
			</div>

			<button type="submit" class="btn-primary w-full" disabled={profileLoading}>
				{profileLoading ? 'Saving...' : 'Save Changes'}
			</button>

			{#if profileErrors.detail}
				<p class="mt-2 text-sm font-bold text-red-500">{profileErrors.detail}</p>
			{/if}
			{#if profileGeneralError}
				<p class="mt-2 text-sm font-bold text-red-500">{profileGeneralError}</p>
			{/if}
			{#if profileSuccessMsg}
				<p class="mt-2 text-sm font-bold text-green-500">{profileSuccessMsg}</p>
			{/if}
		</form>
	</section>

	<!-- Divider -->
	<div style="border-top: 1px solid var(--color-border);"></div>

	<!-- Change Password -->

	<section>
		<p class="mb-4 text-xs font-semibold uppercase tracking-widest" style="color: var(--color-text-muted, var(--color-text));">
			Change Password
		</p>

		<form class="space-y-4" on:submit|preventDefault={handleChangePassword}>
			<div>
				<label class="mb-1 block text-sm font-medium" style="color: var(--color-text);" for="account-current-password">
					Current Password
				</label>
				<input
					id="account-current-password"
					type="password"
					placeholder="********"
					bind:value={currentPassword}
					on:input={() => { const { current_password, detail, ...rest } = passwordErrors; passwordErrors = rest; passwordSuccessMsg = ''; passwordGeneralError = ''; }}
					class="input-field"
				/>
				{#if passwordErrors.current_password}
					<p class="mt-1 text-sm font-bold text-red-500">{passwordErrors.current_password}</p>
				{/if}
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium" style="color: var(--color-text);" for="account-new-password">
					New Password
				</label>
				<input
					id="account-new-password"
					type="password"
					placeholder="At least 8 characters"
					bind:value={newPassword}
					on:input={() => { const { password, detail, ...rest } = passwordErrors; passwordErrors = rest; passwordSuccessMsg = ''; passwordGeneralError = ''; }}
					class="input-field"
				/>
				{#if passwordErrors.password}
					<p class="mt-1 text-sm font-bold text-red-500">{passwordErrors.password}</p>
				{/if}
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium" style="color: var(--color-text);" for="account-new-password2">
					Confirm New Password
				</label>
				<input
					id="account-new-password2"
					type="password"
					placeholder="Re-enter new password"
					bind:value={newPassword2}
					on:input={() => { const { password2, detail, ...rest } = passwordErrors; passwordErrors = rest; passwordSuccessMsg = ''; passwordGeneralError = ''; }}
					class="input-field"
				/>
				{#if passwordErrors.password2}
					<p class="mt-1 text-sm font-bold text-red-500">{passwordErrors.password2}</p>
				{/if}
			</div>

			<button type="submit" class="btn-primary w-full" disabled={passwordLoading}>
				{passwordLoading ? 'Updating...' : 'Update Password'}
			</button>

			{#if passwordErrors.detail}
				<p class="mt-2 text-sm font-bold text-red-500">{passwordErrors.detail}</p>
			{/if}
			{#if passwordGeneralError}
				<p class="mt-2 text-sm font-bold text-red-500">{passwordGeneralError}</p>
			{/if}
			{#if passwordSuccessMsg}
				<p class="mt-2 text-sm font-bold text-green-500">{passwordSuccessMsg}</p>
			{/if}
		</form>

		<p class="mt-4 text-sm" style="color: var(--color-text);">
			Forgotten your password?
			<button
				type="button"
				class="font-bold cursor-pointer underline underline-offset-4"
				style="color: var(--color-ternary-1);"
				on:click={onResetPassword}
			>
				Reset it via email
			</button>
		</p>
	</section>
</div>
