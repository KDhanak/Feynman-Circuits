import { notification } from './IR/stores';

let notificationTimeoutId: ReturnType<typeof setTimeout> | null = null;

export function showNotification(
	message: string,
	type: 'success' | 'error' = 'success',
	duration = 2000
) {
	if (notificationTimeoutId) clearTimeout(notificationTimeoutId);
	notification.set({ message, type });
	notificationTimeoutId = setTimeout(() => {
		notification.set(null);
	}, duration);
}
