import Cookies from "js-cookie";

export const TOKEN_COOKIE = "chat_token";
const USER_STORAGE_KEY = "chat_user";
const TOKEN_MAX_AGE_DAYS = 1;

export type AuthUser = {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  username: string;
};

export function setSession(token: string, user: AuthUser): void {
  Cookies.set(TOKEN_COOKIE, token, {
    expires: TOKEN_MAX_AGE_DAYS,
    sameSite: "lax",
    path: "/",
  });
  if (typeof window !== "undefined") {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }
}

export function clearSession(): void {
  Cookies.remove(TOKEN_COOKIE, { path: "/" });
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(USER_STORAGE_KEY);
  }
}

export function getToken(): string | undefined {
  return Cookies.get(TOKEN_COOKIE);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function updateStoredUser(user: AuthUser): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}
