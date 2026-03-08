// frontend/src/lib/axios.ts
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: () => void;
  reject: (error?: unknown) => void;
}> = [];

const processQueue = (error?: unknown) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  failedQueue = [];
};

const shouldSkipRefresh = (url?: string) => {
  if (!url) return false;

  return (
    url.includes("/accounts/api/auth/login/") ||
    url.includes("/accounts/api/auth/register/") ||
    url.includes("/accounts/api/auth/logout/") ||
    url.includes("/accounts/api/auth/refresh/")
  );
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (shouldSkipRefresh(originalRequest.url)) {
      return Promise.reject(error);
    }

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<void>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(() => api(originalRequest))
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      await api.post("/accounts/api/auth/refresh/");
      processQueue();
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError);
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
