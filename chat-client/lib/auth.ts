const USER_STORAGE_KEY = "chat_user";

/** Public profile of the authenticated user (no credentials). */
export type AuthUser = {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  username: string;
};

function isAuthUser(value: unknown): value is AuthUser {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "number" &&
    typeof v.firstname === "string" &&
    typeof v.lastname === "string" &&
    typeof v.email === "string" &&
    typeof v.username === "string"
  );
}

/** Persists the user profile in localStorage; safe to call on the server (no-op). */
export function setStoredUser(user: AuthUser): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch (err) {
    console.warn("Failed to persist user to localStorage", err);
  }
}

/** Reads the persisted user profile, returning null if absent or invalid. */
export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isAuthUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Removes the persisted user profile from localStorage. */
export function clearStoredUser(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(USER_STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to clear stored user", err);
  }
}
