import { apiUrl } from "./api";
import { getStoredToken } from "./auth";

/** Erreur portant le statut HTTP et un éventuel code d'erreur backend. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Parse une réponse JSON, en levant ApiError si le statut n'est pas 2xx. */
export async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    let code: string | null = null;
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      if (body?.error) message = body.error;
      if (body?.code) code = body.code;
    } catch {
      // ignore les erreurs de parsing
    }
    throw new ApiError(message, res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Header Authorization portant le token Bearer stocké, ou vide si déconnecté.
 * Le backend (cross-domaine sur Render) ne peut pas s'appuyer sur un cookie
 * SameSite : le JWT est donc envoyé explicitement à chaque requête.
 */
export function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Construit un init de fetch pour une requête JSON avec auth Bearer. */
export const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json", ...authHeaders() },
  body: body !== undefined ? JSON.stringify(body) : undefined,
});

/** Construit un init de fetch pour une requête sans corps (GET/DELETE) avec auth Bearer. */
export const authInit = (method = "GET"): RequestInit => ({
  method,
  headers: authHeaders(),
});

/** Raccourci pour les requêtes GET authentifiées. */
export async function getJson<T>(path: string): Promise<T> {
  return handle<T>(await fetch(apiUrl(path), authInit()));
}
