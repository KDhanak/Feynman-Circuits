<script lang="ts">
	import { session, updateProfile, changePassword } from '$lib/auth/session';
	import { normalizeBackendErrors, clearFields } from '$lib/utils/errorUtils';
	import {
		validateRequired,
		validatePasswordLength,
		validatePasswordsMatch
	} from '$lib/utils/formValidation';
	import FormField from './FormField.svelte';

	export let onResetPassword: () => void = () => {};

	// ── Edit Profile ──────────────────────────────────────────────────
	let firstName = $session.user?.first_name ?? '';
	let lastName = $session.user?.last_name ?? '';
	let profileLoading = false;
	let profileSuccessMsg = '';
	let profileGeneralError = '';

	type ProfileErrors = { first_name?: string; last_name?: string; detail?: string };
	let profileErrors: ProfileErrors = {};

	function clearProfileError(...keys: (keyof ProfileErrors)[]) {
		profileErrors = clearFields(profileErrors, keys);
		profileSuccessMsg = '';
		profileGeneralError = '';
	}

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

	function clearPasswordError(...keys: (keyof PasswordErrors)[]) {
		passwordErrors = clearFields(passwordErrors, keys);
		passwordSuccessMsg = '';
		passwordGeneralError = '';
	}

	async function handleUpdateProfile() {
		profileSuccessMsg = '';
		profileGeneralError = '';
		profileErrors = {};

		const validationErrors: ProfileErrors = {
			first_name: validateRequired(firstName, 'First name'),
			last_name: validateRequired(lastName, 'Last name')
		};

		if (validationErrors.first_name || validationErrors.last_name) {
			profileErrors = validationErrors;
			return;
		}

		profileLoading = true;

		try {
			await updateProfile({ first_name: firstName.trim(), last_name: lastName.trim() });
			profileSuccessMsg = 'Profile updated!';
		} catch (err: any) {
			const errors = normalizeBackendErrors(err?.response?.data);
			profileErrors = {
				first_name: errors.first_name,
				last_name: errors.last_name,
				detail: errors.detail
			};
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

		const validationErrors: PasswordErrors = {
			current_password: validateRequired(currentPassword, 'Current password'),
			password: validatePasswordLength(newPassword),
			password2: validatePasswordsMatch(newPassword, newPassword2)
		};

		if (Object.values(validationErrors).some((v) => v)) {
			passwordErrors = validationErrors;
			return;
		}

		passwordLoading = true;

		try {
			await changePassword({
				current_password: currentPassword,
				password: newPassword,
				password2: newPassword2
			});
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
			if (
				!passwordErrors.current_password &&
				!passwordErrors.password &&
				!passwordErrors.password2 &&
				!passwordErrors.detail
			) {
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
			<p
				class="text-xs font-semibold uppercase tracking-widest"
				style="color: var(--color-text-muted, var(--color-text));"
			>
				Account
			</p>
			<p class="mt-1 text-sm" style="color: var(--color-text);">{$session.user?.email}</p>
		</div>

		<form class="space-y-4" on:submit|preventDefault={handleUpdateProfile}>
			<div class="grid grid-cols-2 gap-3">
				<FormField
					id="account-first-name"
					label="First Name"
					bind:value={firstName}
					error={profileErrors.first_name}
					onInput={() => clearProfileError('first_name', 'detail')}
				/>
				<FormField
					id="account-last-name"
					label="Last Name"
					bind:value={lastName}
					error={profileErrors.last_name}
					onInput={() => clearProfileError('last_name', 'detail')}
				/>
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
		<p
			class="mb-4 text-xs font-semibold uppercase tracking-widest"
			style="color: var(--color-text-muted, var(--color-text));"
		>
			Change Password
		</p>

		<form class="space-y-4" on:submit|preventDefault={handleChangePassword}>
			<FormField
				id="account-current-password"
				label="Current Password"
				type="password"
				placeholder="********"
				bind:value={currentPassword}
				error={passwordErrors.current_password}
				onInput={() => clearPasswordError('current_password', 'detail')}
			/>

			<FormField
				id="account-new-password"
				label="New Password"
				type="password"
				placeholder="At least 8 characters"
				bind:value={newPassword}
				error={passwordErrors.password}
				onInput={() => clearPasswordError('password', 'detail')}
			/>

			<FormField
				id="account-new-password2"
				label="Confirm New Password"
				type="password"
				placeholder="Re-enter new password"
				bind:value={newPassword2}
				error={passwordErrors.password2}
				onInput={() => clearPasswordError('password2', 'detail')}
			/>

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
