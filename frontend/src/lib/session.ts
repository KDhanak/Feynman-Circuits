import { writable } from "svelte/store";
import { api } from "./axios";

export type Me = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
};

type SessionState = {
  status: "loading" | "authenticated" | "anonymous";
  user: Me | null;
};

export const session = writable<SessionState>({
  status: "loading",
  user: null
});

let sessionPromise: Promise<void> | null = null;

export async function loadSession() {
  if (sessionPromise) return sessionPromise;

  session.set({ status: "loading", user: null });

  sessionPromise = (async () => {
    try {
      const res = await api.get("/accounts/api/auth/me/");
      session.set({ status: "authenticated", user: res.data });
    } catch {
      session.set({ status: "anonymous", user: null });
    } finally {
      sessionPromise = null;
    }
  })();

  return sessionPromise;
}

export async function login(email: string, password: string) {
  session.set({ status: "loading", user: null });

  try {
    await api.post("/accounts/api/auth/login/", { email, password });
    await loadSession();
  } catch (error) {
    session.set({ status: "anonymous", user: null });
    throw error;
  }
}

export async function logout() {
  session.set({ status: "loading", user: null });

  try {
    await api.post("/accounts/api/auth/logout/");
  } catch {
    // ignore, session still needs clearing
  }

  session.set({ status: "anonymous", user: null });
}
