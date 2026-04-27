<script lang="ts">
	import { verifyPasswordResetOtp } from '$lib/session';
	import { requestPasswordReset } from '$lib/session';

	export let email = '';
	export let onVerified: (resetToken: string) => void = () => {};
	export let onBack: () => void = () => {};

	let otp = ['', '', '', '', '', ''];
	let inputs: HTMLInputElement[] = [];

	let loading = false;
	let generalErrorMsg = '';
	let successMsg = '';
	let resendLoading = false;
	let cooldown = 0;
	let resendMsg = '';

	type OtpErrors = {
		detail?: string;
		otp?: string;
	};

	let otpErrors: OtpErrors = {};

	function normalizeBackendErrors(data: any): Record<string, string> {
		if (!data || typeof data !== 'object') return {};

		return Object.fromEntries(
			Object.entries(data).map(([key, value]) => [
				key,
				Array.isArray(value) ? String(value[0]) : String(value)
			])
		);
	}

	function otpValue() {
		return otp.join('');
	}

	function focusInput(index: number) {
		const el = inputs[index];
		if (el) {
			el.focus();
			el.select();
		}
	}

	function clearOtpBoxes() {
		otp = ['', '', '', '', '', ''];
		focusInput(0);
	}

	function startCooldown(seconds = 30) {
		cooldown = seconds;
		const interval = setInterval(() => {
			cooldown -= 1;
			if (cooldown <= 0) {
				clearInterval(interval);
			}
		}, 1000);
	}

	async function handleResendOtp() {
		if (cooldown > 0 || resendLoading) return;

		resendLoading = true;
		resendMsg = '';
		generalErrorMsg = '';
		otpErrors = {};

		try {
			await requestPasswordReset(email);
			clearOtpBoxes();
			resendMsg = 'A new OTP has been sent.';
			startCooldown(30);
		} catch (err: any) {
			const data = err?.response?.data;
			const errors = normalizeBackendErrors(data);
			generalErrorMsg = errors.detail || 'Could not resend OTP.';
		} finally {
			resendLoading = false;
		}
	}

	async function verifyOtp() {
		const otp = otpValue();

		if (otp.length !== 6) return;

		loading = true;
		generalErrorMsg = '';
		successMsg = '';
		otpErrors = {};

		try {
			const res = await verifyPasswordResetOtp(email, otp);
			successMsg = 'OTP verified successfully.';
			onVerified(res.data.reset_token);
		} catch (err: any) {
			const data = err?.response?.data;
			const errors = normalizeBackendErrors(data);

			otpErrors = {
				detail: errors.detail,
				otp: errors.otp
			};

			if (!otpErrors.detail && !otpErrors.otp) {
				generalErrorMsg = 'Could not verify OTP.';
			}
		} finally {
			loading = false;
		}
	}

	function handleInput(index: number, event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const value = target.value.replace(/\D/g, '');

		generalErrorMsg = '';
		successMsg = '';
		otpErrors = {};

		if (!value) {
			otp[index] = '';
			return;
		}

		// if multiple digits somehow entered, keep last typed digit for normal input
		otp[index] = value.slice(-1);

		if (index < 5) {
			focusInput(index + 1);
		}

		if (otpValue().length === 6) {
			loading = true;
			setTimeout(() => {
				void verifyOtp();
			}, 1500);
		}
	}

	function handleKeydown(index: number, event: KeyboardEvent) {
		const target = event.currentTarget as HTMLInputElement;

		if (event.key === 'Backspace') {
			if (target.value === '' && index > 0) {
				otp[index - 1] = '';
				focusInput(index - 1);
				event.preventDefault();
			}
			return;
		}

		if (event.key === 'ArrowLeft' && index > 0) {
			focusInput(index - 1);
			event.preventDefault();
			return;
		}

		if (event.key === 'ArrowRight' && index < 5) {
			focusInput(index + 1);
			event.preventDefault();
			return;
		}
	}

	function handlePaste(event: ClipboardEvent) {
		event.preventDefault();

		const pasted = event.clipboardData?.getData('text')?.replace(/\D/g, '').slice(0, 6) ?? '';
		if (!pasted) return;

		const chars = pasted.split('');

		for (let i = 0; i < 6; i++) {
			otp[i] = chars[i] ?? '';
		}

		const nextIndex = Math.min(chars.length, 5);
		focusInput(nextIndex);

		if (otpValue().length === 6) {
			setTimeout(() => {
				void verifyOtp();
			}, 1500);
		}
	}
</script>

<div>
	<p class="mb-4 text-sm text-secondary-1">
		Enter the 6-digit OTP sent to
		<span class="font-semibold text-white underline-offset-4 underline">{email}</span>
	</p>

	<div class="flex items-center justify-between gap-2" on:paste={handlePaste}>
		{#each otp as digit, index}
			<input
				bind:this={inputs[index]}
				type="text"
				inputmode="numeric"
				autocomplete="one-time-code"
				maxlength="1"
				class="h-12 w-12 rounded-sm border border-secondary-2 bg-white text-center text-lg font-semibold text-black outline-none focus:border-secondary-3"
				bind:value={otp[index]}
				on:input={(e) => handleInput(index, e)}
				on:keydown={(e) => handleKeydown(index, e)}
			/>
		{/each}
	</div>

	<div class="mt-4 flex items-center justify-between">
		<button
			type="button"
			class="text-sm font-medium text-ternary-1 cursor-pointer disabled:opacity-50 active:text-ternary-3"
			on:click={handleResendOtp}
			disabled={cooldown > 0 || resendLoading}
		>
			{#if resendLoading}
				Sending...
			{:else if cooldown > 0}
				Resend OTP in {cooldown}s
			{:else}
				Resend OTP
			{/if}
		</button>
	</div>

	{#if resendMsg}
		<p class="mt-2 text-sm font-bold text-green-400">{resendMsg}</p>
	{/if}

	{#if otpErrors.otp}
		<p class="mt-3 text-sm font-bold text-red-400">{otpErrors.otp}</p>
	{/if}

	{#if otpErrors.detail}
		<p class="mt-3 text-sm font-bold text-red-400">{otpErrors.detail}</p>
	{/if}

	{#if generalErrorMsg}
		<p class="mt-3 text-sm font-bold text-red-400">{generalErrorMsg}</p>
	{/if}

	{#if successMsg}
		<p class="mt-3 text-sm font-bold text-green-400">{successMsg}</p>
	{/if}

	<div class="mt-5 flex items-center justify-between">
		<button
			type="button"
			class="cursor-pointer text-sm font-medium text-secondary-3 active:text-secondary-1"
			on:click={onBack}
			disabled={loading}
		>
			Update Email
		</button>

		<button
			type="button"
			class="cursor-pointer rounded-sm border border-white bg-ternary-2 px-4 py-2 font-semibold text-white active:border-ternary-3 active:text-ternary-3"
			on:click={() => void verifyOtp()}
			disabled={loading || otpValue().length !== 6}
		>
			{loading ? 'Verifying...' : 'Verify OTP'}
		</button>
	</div>
</div>
