<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/axios';
	import { session, signOut, loadSession, signIn, signUp } from '$lib/session';
	import Icon from '@iconify/svelte';
	import { fly, fade } from 'svelte/transition';

	let isOpen = false;
	let activeTab: 'signin' | 'signup' = 'signin';
	let dropdownOpen = false;

	let signinEmail = '';
	let signinPassword = '';

	let firstName = '';
	let lastName = '';
	let signupEmail = '';
	let signupPassword = '';
	let signupPassword2 = '';

	let loading = false;
	let generalErrorMsg = '';
	let successMsg = '';

	let signoutMessage = '';

	type SignInErrors = {
		email?: string;
		password?: string;
		detail?: string;
	};

	type SignUpErrors = {
		first_name?: string;
		last_name?: string;
		email?: string;
		password?: string;
		password2?: string;
		non_field_errors?: string;
	};

	let signinErrors: SignInErrors = {};
	let signupErrors: SignUpErrors = {};

	onMount(() => {
		const handleClick = (event: MouseEvent) => {
			if (event.target && !(event.target as HTMLElement).closest('.dropdown-container')) {
				dropdownOpen = false;
			}
		};
		document.addEventListener('click', handleClick);
		return () => document.removeEventListener('click', handleClick);
	});

	function openDrawer() {
		isOpen = true;
	}

	function closeDrawer() {
		isOpen = false;
		generalErrorMsg = '';
		successMsg = '';
		signinEmail = '';
		signinPassword = '';
		firstName = '';
		lastName = '';
		signupEmail = '';
		signupPassword = '';
		signupPassword2 = '';
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeDrawer();
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

	async function handleSignIn() {
		generalErrorMsg = '';
		successMsg = '';
		signinErrors = {};
		loading = true;

		try {
			await signIn(signinEmail, signinPassword);

			successMsg = 'Signed in.';
			setTimeout(() => {
				closeDrawer();
			}, 1000);
		} catch (err: any) {
			const data = err?.response?.data;
			const errors = normalizeBackendErrors(data);

			signinErrors = {
				email: errors.email,
				password: errors.password,
				detail: errors.detail
			};

			if (!signinErrors.email && !signinErrors.password && !signinErrors.detail) {
				generalErrorMsg = 'Sign in failed';
			}
		} finally {
			loading = false;
		}
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
			activeTab = 'signin';

			signinEmail = signupEmail;
			signinPassword = '';
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

	async function logoutAndClose() {
		await signOut();
		signoutMessage = '';
		loading = true;

		try {
			await loadSession();
			signoutMessage = 'Signed out!';
			// clear after 2 sec
			setTimeout(() => {
				signoutMessage = '';
			}, 2000);
		} catch (err: any) {
			const data = err?.response?.data;
			const errors = normalizeBackendErrors(data);
			signoutMessage = errors.detail || 'Sign out failed';
		} finally {
			loading = false;
			dropdownOpen = false;
		}
	}
</script>

{#if $session.status === 'loading'}
	<!-- optional skeleton -->
	<button
		class="cursor-pointer rounded-md border px-4 py-1 text-secondary-3 border-secondary-3 bg-white active:border-white active:text-white active:bg-secondary-4"
		disabled>Loading…</button
	>
{:else if $session.status === 'anonymous'}
	<button
		class="cursor-pointer rounded-md border px-4 py-1 text-secondary-3 border-secondary-3 bg-white active:border-white active:text-white active:bg-secondary-4"
		on:click={() => openDrawer()}
	>
		Sign In/Up
	</button>
{:else}
	<div class="relative cursor-pointer dropdown-container">
		<button
			class="flex items-center gap-2 cursor-pointer"
			on:click={() => (dropdownOpen = !dropdownOpen)}
		>
			<span class="text=md text-white font-semibold text-sm">
				{$session.user?.first_name}
			</span>
			<Icon
				icon="icon-park-solid:down-one"
				width="20"
				height="20"
				class="text-white"
				style={dropdownOpen
					? 'transform: rotate(180deg); transition: transform 0.2s ease;'
					: 'transition: transform 0.2s ease;'}
			/>
		</button>
		{#if dropdownOpen}
			<div
				class="absolute top-full w-[130%] right-0 mt-1 bg-ternary-2 border rounded-md shadow-md border-white z-50"
			>
				<button
					on:click={() => {
						logoutAndClose();
						dropdownOpen = false;
					}}
					class="px-2 py-1 items-center w-full text-white cursor-pointer rounded-md active:text-ternary-2 active:bg-white"
					>Sign out</button
				>
			</div>
		{/if}
	</div>
{/if}

{#if isOpen}
	<div
		class="fixed inset-0 z-40 bg-black/40"
		role="button"
		tabindex="0"
		aria-label="Close authentication drawer"
		on:click={handleBackdropClick}
		on:keydown={(event) => event.key === 'Escape' && closeDrawer()}
		transition:fade={{ duration: 300 }}
	>
		<aside
			class="absolute right-0 top-0 h-full w-full max-w-md bg-gray-900 border-l-1 border-t-1 border-b-1 rounded-md border-gray-500 shadow-2xl auth-drawer"
			aria-label="Authentication"
			transition:fly={{ x: 400, duration: 300 }}
		>
			<div class="flex items-center justify-between border-b-1 border-gray-500 px-6 py-4">
				<h2 class="text-lg font-semibold text-white">Welcome</h2>
				<button type="button" aria-label="Close dialog" on:click={closeDrawer}>
					<Icon
						icon="material-symbols:close"
						role="button"
						class="text-ternary-0 cursor-pointer"
						width="24"
						height="24"
						on:click={closeDrawer}
					/>
				</button>
			</div>

			<div class="px-6 pt-5">
				<div class="mb-6 grid grid-cols-2 rounded-md border border-secondary-2 bg-white">
					<button
						type="button"
						on:click={() => (activeTab = 'signin')}
						class={`cursor-pointer rounded-md px-3 py-2 text-sm font-medium ${
							activeTab === 'signin'
								? 'bg-secondary-4 text-secondary-1'
								: 'text-secondary-3 active:bg-secondary-1'
						}`}
					>
						Sign In
					</button>
					<button
						type="button"
						on:click={() => (activeTab = 'signup')}
						class={`cursor-pointer rounded-md px-3 py-2 text-sm font-medium ${
							activeTab === 'signup'
								? 'bg-secondary-4 text-secondary-1'
								: 'text-secondary-3 active:bg-secondary-1'
						}`}
					>
						Sign Up
					</button>
				</div>

				{#if activeTab === 'signin'}
					<form class="space-y-4" on:submit|preventDefault={handleSignIn}>
						<div>
							<label class="mb-1 block text-sm font-medium text-secondary-1" for="signin-email"
								>Email</label
							>
							<input
								id="signin-email"
								type="email"
								placeholder="you@example.com"
								bind:value={signinEmail}
								on:input={() => {
									const { email, detail, ...rest } = signinErrors;
									signinErrors = rest;
								}}
								class="w-full rounded-md border border-secondary-2 bg-white px-3 py-2 text-black font-extralight outline-none focus:border-secondary-3"
							/>
							{#if signinErrors.email}
								<p class="mt-1 text-sm text-red-400 font-bold">{signinErrors.email}</p>
							{/if}
						</div>
						<div>
							<label class="mb-1 block text-sm font-medium text-secondary-1" for="signin-password"
								>Password</label
							>
							<input
								id="signin-password"
								type="password"
								placeholder="********"
								bind:value={signinPassword}
								on:input={() => {
									const { password, detail, ...rest } = signinErrors;
									signinErrors = rest;
								}}
								class="w-full rounded-md border border-secondary-2 bg-white px-3 py-2 text-black font-extralight outline-none focus:border-secondary-3"
							/>
							{#if signinErrors.password}
								<p class="mt-1 text-sm text-red-400 font-bold">{signinErrors.password}</p>
							{/if}
						</div>
						<button
							type="submit"
							class="w-full cursor-pointer rounded-md border px-4 py-2 font-semibold bg-ternary-2 text-white active:bg-ternary-2 border-white active:text-ternary-3 active:border-ternary-3"
						>
							{loading ? 'Signing in...' : 'Sign In'}
						</button>
						{#if signinErrors.detail}
							<p class="mt-2 text-sm text-red-400 font-bold">{signinErrors.detail}</p>
						{/if}
					</form>
				{:else}
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
								class="w-full rounded-md border border-secondary-2 bg-white px-3 py-2 text-black font-extralight outline-none focus:border-secondary-3"
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
								class="w-full rounded-md border border-secondary-2 bg-white px-3 py-2 text-black font-extralight outline-none focus:border-secondary-3"
							/>
							{#if signupErrors.last_name}
								<p class="mt-1 text-sm text-red-400 font-bold">{signupErrors.last_name}</p>
							{/if}
						</div>
						<div>
							<label class="mb-1 block text-sm font-medium text-secondary-1" for="signup-email"
								>Email</label
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
								class="w-full rounded-md border border-secondary-2 bg-white px-3 py-2 text-black font-extralight outline-none focus:border-secondary-3"
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
								class="w-full rounded-md border border-secondary-2 bg-white px-3 py-2 text-black font-extralight outline-none focus:border-secondary-3"
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
								class="w-full rounded-md border border-secondary-2 bg-white px-3 py-2 text-black font-extralight outline-none focus:border-secondary-3"
							/>
							{#if signupErrors.password2}
								<p class="mt-1 text-sm text-red-400 font-bold">{signupErrors.password2}</p>
							{/if}
						</div>
						<button
							type="submit"
							class="w-full cursor-pointer rounded-md border px-4 py-2 font-semibold bg-ternary-2 text-white active:bg-ternary-2 border-white active:text-ternary-3 active:border-ternary-3"
						>
							{loading ? 'Creating...' : 'Create Account'}
						</button>
						{#if signupErrors.non_field_errors}
							<p class="mt-2 text-sm text-red-400 font-bold">{signupErrors.non_field_errors}</p>
						{/if}
					</form>
				{/if}
				{#if generalErrorMsg}
					<p class="mt-2 text-sm text-red-400 font-bold">{generalErrorMsg}</p>
				{/if}
				{#if successMsg}
					<p class="mt-2 text-sm text-green-400 font-bold">{successMsg}</p>
				{/if}
			</div>
		</aside>
	</div>
{/if}

<div class="absolute top-1 w-full right-25">
	{#if signoutMessage}
		<p class="text-sm text-red-400 font-bold">{signoutMessage}</p>
	{/if}
</div>

<style>
</style>
