<script lang="ts">
	let isOpen = false;
	let activeTab: 'signin' | 'signup' = 'signin';

	function openDrawer() {
		isOpen = true;
	}

	function closeDrawer() {
		isOpen = false;
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) closeDrawer();
	}
</script>

<button
	on:click={openDrawer}
	type="button"
	class="cursor-pointer rounded-md border px-4 py-1 text-secondary-3 border-secondary-3 bg-secondary-1 active:border-white active:text-white active:bg-secondary-4"
>
	Sign Up/In
</button>

{#if isOpen}
	<div
		class="fixed inset-0 z-40 bg-black/40"
		role="button"
		tabindex="0"
		aria-label="Close authentication drawer"
		on:click={handleBackdropClick}
		on:keydown={(event) => event.key === 'Escape' && closeDrawer()}
	>
		<aside
			class="absolute right-0 top-0 h-full w-full max-w-md bg-background border-l-1 border-t-1 border-b-1 rounded-md border-secondary-2 shadow-2xl auth-drawer"
			aria-label="Authentication"
		>
			<div class="flex items-center justify-between border-b-1 border-secondary-2 px-6 py-4">
				<h2 class="text-lg font-semibold text-white">Welcome</h2>
				<button
					type="button"
					on:click={closeDrawer}
					class="rounded-md border cursor-pointer border-ternary-2 px-2 py-1 text-ternary-2 active:border-white active:bg-ternary-3 active:text-white"
					aria-label="Close drawer"
				>
					Close
				</button>
			</div>

			<div class="px-6 pt-5">
				<div class="mb-6 grid grid-cols-2 rounded-md border border-secondary-2 bg-secondary-1">
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
					<form class="space-y-4" on:submit|preventDefault>
						<div>
							<label class="mb-1 block text-sm font-medium text-secondary-1" for="signin-email"
								>Email</label
							>
							<input
								id="signin-email"
								type="email"
								placeholder="you@example.com"
								class="w-full rounded-md border border-secondary-2 bg-secondary-1 px-3 py-2 text-secondary-2 font-extralight outline-none focus:border-secondary-3"
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
								class="w-full rounded-md border border-secondary-2 bg-secondary-1 px-3 py-2 text-secondary-2 font-extralight outline-none focus:border-secondary-3"
							/>
						</div>
						<button
							type="submit"
							class="w-full cursor-pointer rounded-md border px-4 py-2 font-semibold bg-ternary-2 text-white active:bg-ternary-2 border-white active:text-ternary-3 active:border-ternary-3"
						>
							Sign In
						</button>
					</form>
				{:else}
					<form class="space-y-4" on:submit|preventDefault>
						<div>
							<label class="mb-1 block text-sm font-medium text-secondary-1" for="signup-name"
								>First Name</label
							>
							<input
								id="signup-name"
								type="text"
								placeholder="First Name"
								class="w-full rounded-md border border-secondary-2 bg-secondary-1 px-3 py-2 text-secondary-2 font-extralight outline-none focus:border-secondary-3"
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
								class="w-full rounded-md border border-secondary-2 bg-secondary-1 px-3 py-2 text-secondary-2 font-extralight outline-none focus:border-secondary-3"
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
								class="w-full rounded-md border border-secondary-2 bg-secondary-1 px-3 py-2 text-secondary-2 font-extralight outline-none focus:border-secondary-3"
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
								class="w-full rounded-md border border-secondary-2 bg-secondary-1 px-3 py-2 text-secondary-2 font-extralight outline-none focus:border-secondary-3"
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
								class="w-full rounded-md border border-secondary-2 bg-secondary-1 px-3 py-2 text-secondary-2 font-extralight outline-none focus:border-secondary-3"
							/>
						</div>
						<button
							type="submit"
							class="w-full cursor-pointer rounded-md border px-4 py-2 font-semibold bg-ternary-2 text-white active:bg-ternary-2 border-white active:text-ternary-3 active:border-ternary-3"
						>
							Create Account
						</button>
					</form>
				{/if}
			</div>
		</aside>
	</div>
{/if}

<style>
	.auth-drawer {
		animation: slide-in 0.3s ease-out;
	}

	@keyframes slide-in {
		from {
			transform: translateX(100%);
		}
		to {
			transform: translateX(0);
		}
	}
</style>
