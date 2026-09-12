<script lang="ts">
	import { session, updateProfile, changePassword, deleteAccount } from '$lib/auth/session';
	import { normalizeBackendErrors, extractResponseData, clearFields } from '$lib/utils/errorUtils';
	import {
		validateRequired,
		validatePasswordLength,
		validatePasswordsMatch
	} from '$lib/utils/formValidation';
	import FormField from './FormField.svelte';
	import ConfirmDialog from '../ConfirmDialog.svelte';

	// ── Delete Account ────────────────────────────────────────────────
	let deletePassword = '';
	let deletePasswordError: string | undefined;
	let deleteGeneralError = '';
	let deleteLoading = false;
	let confirmDeleteOpen = false;

	// Check the password box first, then ask "are you sure?" before deleting.
	function askDeleteAccount() {
		deleteGeneralError = '';
		deletePasswordError = validateRequired(deletePassword, 'Password');
		if (deletePasswordError) return;
		confirmDeleteOpen = true;
	}

	async function handleDeleteAccount() {
		confirmDeleteOpen = false;
		deleteLoading = true;
		try {
			// On success the session becomes signed out, so this panel closes by itself.
			await deleteAccount(deletePassword);
			deletePassword = '';
		} catch (err) {
			const errors = normalizeBackendErrors(extractResponseData(err));
			deletePasswordError = errors.password;
			if (!deletePasswordError) deleteGeneralError = errors.detail || 'Could not delete account.';
		} finally {
			deleteLoading = false;
		}
	}

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
		} catch (err) {
			const errors = normalizeBackendErrors(extractResponseData(err));
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
		} catch (err) {
			const errors = normalizeBackendErrors(extractResponseData(err));
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

	<!-- Divider -->
	<div style="border-top: 1px solid var(--color-border);"></div>

	<!-- Delete Account -->
	<section>
		<p class="mb-2 text-xs font-semibold uppercase tracking-widest text-red-500">Delete Account</p>
		<p class="mb-4 text-sm" style="color: var(--color-muted);">
			This deletes your account and all your saved circuits for good. Share links to your public
			circuits will stop working. This cannot be undone. We will email you a confirmation.
		</p>

		<form class="space-y-4" on:submit|preventDefault={askDeleteAccount}>
			<FormField
				id="account-delete-password"
				label="Type your password to confirm"
				type="password"
				placeholder="********"
				bind:value={deletePassword}
				error={deletePasswordError}
				onInput={() => {
					deletePasswordError = undefined;
					deleteGeneralError = '';
				}}
			/>

			<button
				type="submit"
				class="w-full cursor-pointer rounded-sm bg-red-500 px-4 py-2 font-semibold text-white shadow active:bg-red-600 disabled:opacity-60"
				disabled={deleteLoading}
			>
				{deleteLoading ? 'Deleting...' : 'Delete my account'}
			</button>

			{#if deleteGeneralError}
				<p class="mt-2 text-sm font-bold text-red-500">{deleteGeneralError}</p>
			{/if}
		</form>
	</section>
</div>

<ConfirmDialog
	open={confirmDeleteOpen}
	title="Delete your account?"
	message="Your account and all your saved circuits will be deleted for good. This cannot be undone."
	confirmLabel="Delete for good"
	danger
	onConfirm={handleDeleteAccount}
	onCancel={() => (confirmDeleteOpen = false)}
/>
