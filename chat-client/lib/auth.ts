const USER_STORAGE_KEY = "chat_user";
const TOKEN_STORAGE_KEY = "chat_token";
/** Non-HttpOnly flag cookie read by the Next proxy middleware to gate routes. */
const AUTH_FLAG_COOKIE = "chat_auth";

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

/**
 * Persists the JWT in localStorage and raises a non-HttpOnly flag cookie on the
 * front domain. The flag lets the Next proxy middleware (which only sees cookies,
 * not localStorage) gate routes; the JWT itself never travels as a cross-site
 * cookie — it is sent as an `Authorization: Bearer` header on each API call.
 */
export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch (err) {
    // Ne pas poser le flag si le jeton n'a pas pu être stocké : sinon le proxy
    // laisse entrer sur /chat alors qu'authHeaders() n'a aucun Bearer à envoyer.
    console.warn("Failed to persist token to localStorage", err);
    throw err;
  }
  document.cookie = `${AUTH_FLAG_COOKIE}=1; path=/; max-age=86400; samesite=lax`;
}

/** Reads the persisted JWT, or null if logged out. */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Removes the persisted JWT and clears the route-gating flag cookie. */
export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to clear token", err);
  }
  document.cookie = `${AUTH_FLAG_COOKIE}=; path=/; max-age=0; samesite=lax`;
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
