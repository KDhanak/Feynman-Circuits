<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/axios';
	import { session, logout, loadSession } from '$lib/session';
	import Icon from '@iconify/svelte';
	import { fly, fade } from 'svelte/transition';

	let isOpen = false;
	let activeTab: 'signin' | 'signup' = 'signin';
	let dropdownOpen = false;

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
		errorMsg = '';
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

	let signinEmail = '';
	let signinPassword = '';

	let firstName = '';
	let lastName = '';
	let signupEmail = '';
	let signupPassword = '';
	let signupPassword2 = '';

	let loading = false;
	let errorMsg = '';
	let successMsg = '';

	let signoutMessage = '';

	function getAxiosErrorMessage(err: any): string {
		// Axios error shape: err.response?.data
		const data = err?.response?.data;
		if (!data) return err?.message ?? 'Request failed';

		if (typeof data === 'string') return data;
		if (data.detail) return data.detail;

		// DRF validation errors: {field: ["msg"]}
		const first = Object.values(data)?.flat?.()?.[0];
		return typeof first === 'string' && first ? first : 'Request failed';
	}

	async function handleSignIn() {
		errorMsg = '';
		successMsg = '';
		loading = true;

		try {
			await api.post('accounts/api/auth/login/', {
				email: signinEmail,
				password: signinPassword
			});

			successMsg = 'Signed in.';

			await loadSession();

			setTimeout(() => {
				closeDrawer();
			}, 1000);
		} catch (err: any) {
			errorMsg = getAxiosErrorMessage(err) || 'Sign in failed';
		} finally {
			loading = false;
		}
	}

	async function handleSignUp() {
		errorMsg = '';
		successMsg = '';
		loading = true;

		try {
			await api.post('accounts/api/auth/register/', {
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
		} catch (err: any) {
			errorMsg = getAxiosErrorMessage(err) || 'Sign up failed';
		} finally {
			loading = false;
		}
	}

	async function logoutAndClose() {
		await logout();
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
			signoutMessage = getAxiosErrorMessage(err) || 'Sign out failed';
		} finally {
			loading = false;
			dropdownOpen = false;
		}
	}
</script>

{#if $session.status === 'loading'}
	<!-- optional skeleton -->
	<button
		class="cursor-pointer rounded-md border px-4 py-1 text-secondary-3 border-secondary-3 bg-secondary-1 active:border-white active:text-white active:bg-secondary-4"
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
			<span class="text=md text-white">
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
				class="absolute top-full right-1.5 mt-1 bg-ternary-2 border rounded-md shadow-md border-white z-50"
			>
				<button
					on:click={() => {
						logoutAndClose();
						dropdownOpen = false;
					}}
					class="block px-2 py-1 w-full text-white cursor-pointer rounded-md active:text-ternary-2 active:bg-white"
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
								class="w-full rounded-md border border-secondary-2 bg-white px-3 py-2 text-black font-extralight outline-none focus:border-secondary-3"
							/>
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
								class="w-full rounded-md border border-secondary-2 bg-white px-3 py-2 text-black font-extralight outline-none focus:border-secondary-3"
							/>
						</div>
						<button
							type="submit"
							class="w-full cursor-pointer rounded-md border px-4 py-2 font-semibold bg-ternary-2 text-white active:bg-ternary-2 border-white active:text-ternary-3 active:border-ternary-3"
						>
							{loading ? 'Signing in...' : 'Sign In'}
						</button>
					</form>
				{:else}
					<form class="space-y-4" on:submit|preventDefault={handleSignUp}>
						<div>
							<label class="mb-1 block text-sm font-medium text-secondary-1" for="signup-name"
								>First Name</label
							>
							<input
								id="signup-name"
								type="text"
								placeholder="First Name"
								bind:value={firstName}
								class="w-full rounded-md border border-secondary-2 bg-white px-3 py-2 text-black font-extralight outline-none focus:border-secondary-3"
							/>
						</div>
						<div>
							<label class="mb-1 block text-sm font-medium text-secondary-1" for="signup-name"
								>Last Name</label
							>
							<input
								id="signup-name"
								type="text"
								placeholder="Last Name"
								bind:value={lastName}
								class="w-full rounded-md border border-secondary-2 bg-white px-3 py-2 text-black font-extralight outline-none focus:border-secondary-3"
							/>
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
								class="w-full rounded-md border border-secondary-2 bg-white px-3 py-2 text-black font-extralight outline-none focus:border-secondary-3"
							/>
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
								class="w-full rounded-md border border-secondary-2 bg-white px-3 py-2 text-black font-extralight outline-none focus:border-secondary-3"
							/>
						</div>
						<div>
							<label class="mb-1 block text-sm font-medium text-secondary-1" for="signup-password"
								>Confirm Password</label
							>
							<input
								id="signup-password"
								type="password"
								placeholder="At least 8 characters"
								bind:value={signupPassword2}
								class="w-full rounded-md border border-secondary-2 bg-white px-3 py-2 text-black font-extralight outline-none focus:border-secondary-3"
							/>
						</div>
						<button
							type="submit"
							class="w-full cursor-pointer rounded-md border px-4 py-2 font-semibold bg-ternary-2 text-white active:bg-ternary-2 border-white active:text-ternary-3 active:border-ternary-3"
						>
							{loading ? 'Creating...' : 'Create Account'}
						</button>
					</form>
				{/if}
				{#if errorMsg}
					<p class="mt-2 text-sm text-red-400 font-bold">{errorMsg}</p>
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
