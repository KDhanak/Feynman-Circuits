<script lang="ts">
	import { onMount } from 'svelte';
	import { session, signOut, loadSession } from '$lib/session';
	import Icon from '@iconify/svelte';
	import { fly, fade } from 'svelte/transition';
	import SignIn from './SignIn.svelte';
	import SignUp from './SignUp.svelte';
	import ForgotPassword from './ForgotPassword.svelte';
	import OtpVerification from './OtpVerification.svelte';
	import ResetPassword from './ResetPassword.svelte';

	type AuthView = 'signin' | 'signup' | 'forgot' | 'otp' | 'reset';

	let isOpen = false;
	let activeView: AuthView = 'signin';
	let dropdownOpen = false;
	let loading = false;
	let signoutMessage = '';
	let prefilledSignInEmail = '';
	let resetEmail = '';
	let resetToken = '';

	const viewMeta: Record<
		AuthView,
		{
			title: string;
			showTabs: boolean;
			showBack: boolean;
			backTo?: AuthView;
		}
	> = {
		signin: {
			title: 'Sign In',
			showTabs: true,
			showBack: false
		},
		signup: {
			title: 'Create Account',
			showTabs: true,
			showBack: false
		},
		forgot: {
			title: 'Forgot Password',
			showTabs: false,
			showBack: true,
			backTo: 'signin'
		},
		otp: {
			title: 'Verify OTP',
			showTabs: false,
			showBack: true,
			backTo: 'forgot'
		},
		reset: {
			title: 'Reset Password',
			showTabs: false,
			showBack: true,
			backTo: 'otp'
		}
	};

	$: currentView = viewMeta[activeView];

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
		prefilledSignInEmail = '';
		activeView = 'signin';
		resetEmail = '';
		resetToken = '';
	}

	function goBack() {
		if (currentView.backTo) {
			activeView = currentView.backTo;
		}
		resetToken = '';
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
		on:click={openDrawer}
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
				class="absolute top-full w-[130%] right-0 mt-1 bg-ternary-2 border rounded-md shadow-md border-white z-100"
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
		class="fixed inset-0 z-100 bg-slate-950/60"
		role="button"
		tabindex="0"
		aria-label="Close authentication drawer"
		on:click={handleBackdropClick}
		on:keydown={(event) => event.key === 'Escape' && closeDrawer()}
		transition:fade={{ duration: 300 }}
	>
		<aside
			class="absolute right-0 top-0 h-full w-full max-w-md bg-slate-950 border-l-1 border-t-1 border-b-1 rounded-md border-gray-500 shadow-2xl auth-drawer"
			aria-label="Authentication"
			transition:fly={{ x: 400, duration: 300 }}
		>
			<div class="flex items-center justify-between border-b-1 border-gray-500 px-6 py-4">
				<div class="flex items-center gap-3">
					{#if currentView.showBack}
						<button
							type="button"
							class="cursor-pointer text-white active:text-ternary-2"
							on:click={goBack}
						>
							<Icon icon="material-symbols:arrow-back" width="22" height="22" />
						</button>
					{/if}

					<h2 class="text-lg font-semibold text-white">{currentView.title}</h2>
				</div>

				<button type="button" aria-label="Close dialog" on:click={closeDrawer}>
					<Icon
						icon="material-symbols:close"
						class="text-ternary-0 cursor-pointer"
						width="24"
						height="24"
					/>
				</button>
			</div>

			<div class="px-6 pt-5">
				{#if currentView.showTabs}
					<div class="mb-6 relative rounded-md border border-secondary-2 bg-white overflow-hidden">
						<!-- Sliding background -->
						<div
							class="absolute top-0 bottom-0 w-1/2 bg-secondary-4 transition-all duration-300 ease-in-out rounded-md"
							style="transform: translateX({activeView === 'signin' ? '0%' : '100%'});"
						></div>

						<div class="grid grid-cols-2 relative">
							<button
								type="button"
								on:click={() => (activeView = 'signin')}
								class={`cursor-pointer px-3 py-2 text-sm font-medium transition-colors duration-300 ${
									activeView === 'signin' ? 'text-secondary-1' : 'text-secondary-3'
								}`}
							>
								Sign In
							</button>
							<button
								type="button"
								on:click={() => (activeView = 'signup')}
								class={`cursor-pointer px-3 py-2 text-sm font-medium transition-colors duration-300 ${
									activeView === 'signup' ? 'text-secondary-1' : 'text-secondary-3'
								}`}
							>
								Sign Up
							</button>
						</div>
					</div>
				{/if}

				<div class="relative" style="min-height: 420px;">
					{#key activeView}
						<div
							transition:fly={{ x: activeView === 'signup' ? 40 : -40, duration: 280, opacity: 0 }}
							class="absolute w-full"
						>
							{#if activeView === 'signin'}
								<SignIn
									initialEmail={prefilledSignInEmail}
									onSignedIn={closeDrawer}
									onSwitchToForgot={() => (activeView = 'forgot')}
								/>
							{:else if activeView === 'signup'}
								<SignUp
									onSignedUp={(email) => {
										prefilledSignInEmail = email;
										activeView = 'signin';
									}}
									onSwitchToSignIn={() => (activeView = 'signin')}
								/>
							{:else if activeView === 'forgot'}
								<ForgotPassword
									onOtpSent={(email) => {
										resetEmail = email;
										activeView = 'otp';
									}}
								/>
							{:else if activeView === 'otp'}
								<OtpVerification
									email={resetEmail}
									onVerified={(token) => {
										resetToken = token;
										activeView = 'reset';
									}}
									onBack={() => (activeView = 'forgot')}
								/>
							{:else if activeView === 'reset'}
								<ResetPassword
									{resetToken}
									onResetDone={() => {
										resetToken = '';
										resetEmail = '';
										activeView = 'signin';
									}}
								/>
							{/if}
						</div>
					{/key}
				</div>
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
