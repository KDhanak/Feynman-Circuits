import { writable } from 'svelte/store';
import { api } from '../api/axios';
import { clearCircuitListCache } from '../stores/circuitListCache';

export type Me = {
	id: number;
	email: string;
	first_name: string;
	last_name: string;
};

type SessionState = {
	status: 'loading' | 'authenticated' | 'anonymous';
	user: Me | null;
};

export const session = writable<SessionState>({
	status: 'loading',
	user: null
});

let sessionPromise: Promise<void> | null = null;

export async function loadSession() {
	if (sessionPromise) return sessionPromise;

	session.set({ status: 'loading', user: null });

	sessionPromise = (async () => {
		try {
			const res = await api.get('/accounts/api/auth/me/');
			session.set({ status: 'authenticated', user: res.data });
		} catch {
			session.set({ status: 'anonymous', user: null });
		} finally {
			sessionPromise = null;
		}
	})();

	return sessionPromise;
}

export async function signIn(email: string, password: string) {
	session.set({ status: 'loading', user: null });

	try {
		await api.post('/accounts/api/auth/signin/', { email, password });
		await loadSession();
	} catch (error) {
		session.set({ status: 'anonymous', user: null });
		throw error;
	}
}

export async function signUp(payload: {
	email: string;
	password: string;
	password2: string;
	first_name: string;
	last_name: string;
}) {
	await api.post('/accounts/api/auth/signup/', payload);
}

export async function signOut() {
	session.set({ status: 'loading', user: null });

	try {
		await api.post('/accounts/api/auth/signout/');
	} catch {
		// ignore the error, the session still needs to be cleared
	}

	clearCircuitListCache();
	session.set({ status: 'anonymous', user: null });
}

export async function updateProfile(data: { first_name: string; last_name: string }) {
	const res = await api.patch('/accounts/api/auth/profile/', data);
	session.update((s) => (s.status === 'authenticated' ? { ...s, user: res.data } : s));
}

export async function changePassword(data: {
	current_password: string;
	password: string;
	password2: string;
}) {
	await api.post('/accounts/api/auth/change-password/', data);
}

// Deletes the account and all its saved circuits on the server, then signs the
// user out here. Throws if the password is wrong, and nothing is deleted then.
export async function deleteAccount(password: string) {
	await api.post('/accounts/api/auth/delete-account/', { password });
	clearCircuitListCache();
	session.set({ status: 'anonymous', user: null });
}

export async function requestPasswordReset(email: string) {
	return api.post('/accounts/api/auth/password-reset/', { email });
}

export async function verifyPasswordResetOtp(email: string, otp: string) {
	return api.post('/accounts/api/auth/password-reset/verify-otp/', { email, otp });
}

export function confirmPasswordReset(payload: {
	reset_token: string;
	password: string;
	password2: string;
}) {
	return api.post('/accounts/api/auth/password-reset/confirm/', payload);
}
