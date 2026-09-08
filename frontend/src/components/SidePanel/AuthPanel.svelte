<script lang="ts">
	import { session, signOut, loadSession } from '$lib/auth/session';
	import Icon from '@iconify/svelte';
	import { fly, fade } from 'svelte/transition';
	import SignIn from './SignIn.svelte';
	import SignUp from './SignUp.svelte';
	import ForgotPassword from './ForgotPassword.svelte';
	import OtpVerification from './OtpVerification.svelte';
	import ResetPassword from './ResetPassword.svelte';
	import MyCircuits from './MyCircuits.svelte';
	import MyAccount from './MyAccount.svelte';
	import Settings from './Settings.svelte';
	import { showNotification } from '$lib/utils/notificationUtils';
	import { normalizeBackendErrors, extractResponseData } from '$lib/utils/errorUtils';
	import { clickOutside } from '$lib/utils/clickOutside';
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';

	type AuthView = 'signin' | 'signup' | 'forgot' | 'otp' | 'reset' | 'account' | 'settings';

	let isOpen = false;
	let circuitsOpen = false;
	let activeView: AuthView = 'signin';
	let dropdownOpen = false;
	let prefilledSignInEmail = '';
	let resetEmail = '';
	let resetToken = '';
	let resetReturnView: AuthView = 'signin';

	const viewMeta: Record<
		AuthView,
		{
			title: string;
			showTabs: boolean;
			showBack: boolean;
			backTo?: AuthView;
		}
	> = {
		signin: { title: 'Sign In', showTabs: true, showBack: false },
		signup: { title: 'Create Account', showTabs: true, showBack: false },
		forgot: { title: 'Forgot Password', showTabs: false, showBack: true, backTo: 'signin' },
		otp: { title: 'Verify OTP', showTabs: false, showBack: true, backTo: 'forgot' },
		reset: { title: 'Reset Password', showTabs: false, showBack: true, backTo: 'otp' },
		account: { title: 'My Account', showTabs: false, showBack: false },
		settings: { title: 'Settings', showTabs: false, showBack: false }
	};

	$: currentView = viewMeta[activeView];

	// Lock background page scroll while the drawer is open so touch scrolling
	// stays inside the panel instead of moving the page behind it.
	$: if (browser) {
		document.body.style.overflow = isOpen || circuitsOpen ? 'hidden' : '';
	}

	onDestroy(() => {
		if (browser) document.body.style.overflow = '';
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
		resetReturnView = 'signin';
	}

	function goBack() {
		if (activeView === 'forgot' && $session.status === 'authenticated') {
			activeView = 'account';
		} else if (currentView.backTo) {
			activeView = currentView.backTo;
		}
		resetToken = '';
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeDrawer();
		}
	}

	async function logoutAndClose() {
		await signOut();

		try {
			await loadSession();
			showNotification('Signed out!', 'success');
		} catch (err) {
			const data = extractResponseData(err);
			const errors = normalizeBackendErrors(data);
			showNotification(errors.detail || 'Sign out failed', 'error');
		} finally {
			dropdownOpen = false;
		}
	}
</script>

{#if $session.status === 'loading'}
	<button class="btn-highlight" disabled>Loading…</button>
{:else if $session.status === 'anonymous'}
	<button class="btn-highlight" on:click={openDrawer}>Sign In/Up</button>
{:else}
	<div
		class="relative flex flex-col items-center justify-center dropdown-container bg-transparent shadow-sm shadow-measured rounded-sm"
		use:clickOutside={() => (dropdownOpen = false)}
	>
		<button
			style="color: var(--color-text);"
			class="flex h-9 items-center justify-center gap-1 px-2 rounded-sm cursor-pointer min-w-28 active:bg-measured active:text-white active:border active:border-white transition-colors duration-200 outline-none"
			on:click={() => (dropdownOpen = !dropdownOpen)}
		>
			<span class="font-semibold text-sm truncate">{$session.user?.first_name}</span>
			<Icon
				icon="icon-park-solid:down-one"
				width="16"
				height="16"
				style={dropdownOpen
					? 'transform: rotate(180deg); transition: transform 0.2s ease;'
					: 'transition: transform 0.2s ease;'}
			/>
		</button>

		{#if dropdownOpen}
			<div
				transition:fly={{ y: -12, duration: 200 }}
				class="absolute top-full w-full right-0 mt-1 text-sm rounded-sm z-100 shadow-sm shadow-measured bg-surface"
			>
				<button
					on:click={() => {
						dropdownOpen = false;
						circuitsOpen = true;
					}}
					class="btn-highlight-item rounded-t-sm">My Circuits</button
				>
				<button
					on:click={() => {
						dropdownOpen = false;
						activeView = 'account';
						openDrawer();
					}}
					class="btn-highlight-item">My Account</button
				>
				<button
					on:click={() => {
						dropdownOpen = false;
						activeView = 'settings';
						openDrawer();
					}}
					class="btn-highlight-item">Settings</button
				>
				<button
					on:click={() => {
						logoutAndClose();
						dropdownOpen = false;
					}}
					class="btn-highlight-danger rounded-b-sm">Sign out</button
				>
			</div>
		{/if}
	</div>
{/if}

{#if isOpen}
	<div
		class="fixed inset-0 z-100"
		style="background-color: (var(--color-background) / 0.5); backdrop-filter: blur(1px);"
		role="button"
		tabindex="0"
		aria-label="Close authentication drawer"
		on:click={handleBackdropClick}
		on:keydown={(event) => event.key === 'Escape' && closeDrawer()}
		transition:fade={{ duration: 300 }}
	>
		<aside
			class="absolute right-0 top-0 h-full w-full sm:max-w-md border-l border-t border-b rounded-sm shadow-2xl overflow-y-auto"
			style="background-color: var(--color-surface); border-color: var(--color-text);"
			aria-label="Authentication"
			transition:fly={{ x: 400, duration: 300 }}
		>
			<div
				class="flex items-center justify-between px-6 py-4"
				style="border-bottom: 1px solid var(--color-border);"
			>
				<div class="flex items-center gap-3">
					{#if currentView.showBack}
						<button
							type="button"
							class="cursor-pointer transition-colors"
							style="color: var(--color-text);"
							on:click={goBack}
						>
							<Icon icon="material-symbols:arrow-back" width="22" height="22" />
						</button>
					{/if}
					<h2 class="text-lg font-semibold" style="color: var(--color-text);">
						{currentView.title}
					</h2>
				</div>

				<button type="button" aria-label="Close dialog" on:click={closeDrawer}>
					<Icon
						icon="material-symbols:close"
						class="cursor-pointer text-red-500"
						width="24"
						height="24"
					/>
				</button>
			</div>

			<div class="px-6 pt-5 pb-8">
				{#if currentView.showTabs}
					<div class="mb-6 relative rounded-sm border border-secondary-2 bg-white overflow-hidden">
						<div
							class="absolute top-0 bottom-0 w-1/2 transition-all duration-300 ease-in-out rounded-sm"
							style="background-color: var(--color-secondary-4); transform: translateX({activeView ===
							'signin'
								? '0%'
								: '100%'});"
						></div>
						<div class="grid grid-cols-2 relative">
							<button
								type="button"
								on:click={() => (activeView = 'signin')}
								class={`cursor-pointer px-3 py-2 text-sm font-medium transition-colors duration-500 ease-in-out ${activeView === 'signin' ? 'text-secondary-1' : 'text-secondary-3'}`}
								>Sign In</button
							>
							<button
								type="button"
								on:click={() => (activeView = 'signup')}
								class={`cursor-pointer px-3 py-2 text-sm font-medium transition-colors duration-500 ease-in-out ${activeView === 'signup' ? 'text-secondary-1' : 'text-secondary-3'}`}
								>Sign Up</button
							>
						</div>
					</div>
				{/if}

				<div class="grid" style="min-height: 420px;">
					{#key activeView}
						<div
							transition:fly={{ x: activeView === 'signup' ? 40 : -40, duration: 450, opacity: 0 }}
							class="w-full"
							style="grid-area: 1 / 1;"
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
								/>
							{:else if activeView === 'forgot'}
								<ForgotPassword
									initialEmail={resetEmail}
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
										const returnTo = resetReturnView;
										resetToken = '';
										resetEmail = '';
										resetReturnView = 'signin';
										activeView = returnTo;
									}}
								/>
							{:else if activeView === 'account'}
								<MyAccount
									onResetPassword={() => {
										resetEmail = $session.user?.email ?? '';
										resetReturnView = 'account';
										activeView = 'forgot';
									}}
								/>
							{:else if activeView === 'settings'}
								<Settings />
							{/if}
						</div>
					{/key}
				</div>
			</div>
		</aside>
	</div>
{/if}

{#if circuitsOpen}
	<MyCircuits onClose={() => (circuitsOpen = false)} />
{/if}
