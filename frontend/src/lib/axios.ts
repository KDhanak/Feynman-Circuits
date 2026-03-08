// frontend/src/lib/axios.ts
import axios from "axios";
import { session } from "./session";  // Import to update session on refresh failure

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
    withCredentials: true,
});

// Refresh state management
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (value?: any) => void;
    reject: (error?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else {
            resolve(token);
        }
    });
    failedQueue = [];
};

// Response interceptor for handling 401s and refreshing tokens
api.interceptors.response.use(
    (response) => response,  // Pass through successful responses
    async (error) => {
        const originalRequest = error.config;

        // Check if it's a 401 and we haven't retried yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                // If already refreshing, queue this request
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(() => {
                    return api(originalRequest);
                }).catch((err) => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Attempt to refresh the token
                await api.post('accounts/api/auth/refresh/');
                
                // Refresh succeeded, process queued requests
                processQueue(null);
                
                // Retry the original request
                return api(originalRequest);
            } catch (refreshError) {
                // Refresh failed, reject queued requests and log out
                processQueue(refreshError, null);
                session.set({ status: 'anonymous', user: null });  // Force logout
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        // For non-401 errors or already retried, reject as-is
        return Promise.reject(error);
    }
);
