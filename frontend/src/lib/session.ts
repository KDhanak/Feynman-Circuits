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

export async function loadSession() {
    try {
        const res = await api.get("/accounts/api/auth/me/");
        session.set({
            status: "authenticated",
            user: res.data
        });
    } catch (error) {
        session.set({
            status: "anonymous", user: null
        });
    }
};


export async function logout() {
    try {
        await api.post("/accounts/api/auth/logout/");
    } finally {
        session.set({
            status: "anonymous", user: null
        });
    }
};
