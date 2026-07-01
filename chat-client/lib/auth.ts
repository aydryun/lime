const USER_STORAGE_KEY = "chat_user";
const TOKEN_STORAGE_KEY = "chat_token";
/** Cookie indicateur non-HttpOnly, lu par le middleware proxy Next pour filtrer les routes. */
const AUTH_FLAG_COOKIE = "chat_auth";

/** Profil public de l'utilisateur authentifié (sans identifiants). */
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

/** Persiste le profil utilisateur dans le localStorage ; sans effet côté serveur (no-op). */
export function setStoredUser(user: AuthUser): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch (err) {
    console.warn("Failed to persist user to localStorage", err);
  }
}

/**
 * Persiste le JWT dans le localStorage et pose un cookie indicateur non-HttpOnly
 * sur le domaine front. L'indicateur permet au middleware proxy Next (qui ne voit
 * que les cookies, pas le localStorage) de filtrer les routes ; le JWT lui-même ne
 * circule jamais comme cookie intersite — il est envoyé via un header
 * `Authorization: Bearer` à chaque appel API.
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

/** Lit le JWT persisté, ou null si déconnecté. */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Retire le JWT persisté et efface le cookie indicateur de filtrage des routes. */
export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to clear token", err);
  }
  document.cookie = `${AUTH_FLAG_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** Lit le profil utilisateur persisté, renvoie null s'il est absent ou invalide. */
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

/** Retire le profil utilisateur persisté du localStorage. */
export function clearStoredUser(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(USER_STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to clear stored user", err);
  }
}
