const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRequired(value: string, label: string): string | undefined {
	if (!value.trim()) return `${label} is required.`;
	return undefined;
}

export function validateEmail(value: string): string | undefined {
	if (!value.trim()) return 'Email is required.';
	if (!EMAIL_RE.test(value)) return 'Enter a valid email address.';
	return undefined;
}

export function validatePasswordLength(value: string): string | undefined {
	if (!value) return 'Password is required.';
	if (value.length < 8) return 'Password must be at least 8 characters.';
	return undefined;
}

export function validatePasswordsMatch(password: string, password2: string): string | undefined {
	if (password !== password2) return 'Passwords do not match.';
	return undefined;
}

export function validateOtp(value: string): string | undefined {
	if (!/^\d{6}$/.test(value)) return 'Enter the 6-digit code.';
	return undefined;
}
