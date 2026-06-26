import { apiUrl } from "./api";
import { getStoredToken } from "./auth";

/** Error carrying the HTTP status and optional backend error code. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Parses a JSON response, throwing ApiError on non-2xx. */
export async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    let code: string | null = null;
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      if (body?.error) message = body.error;
      if (body?.code) code = body.code;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(message, res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Authorization header carrying the stored Bearer token, or empty when logged
 * out. The backend (cross-domain on Render) cannot rely on a SameSite cookie,
 * so the JWT is sent explicitly on every request.
 */
export function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Builds a fetch init for a JSON request with Bearer auth. */
export const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json", ...authHeaders() },
  body: body !== undefined ? JSON.stringify(body) : undefined,
});

/** Builds a fetch init for a body-less request (GET/DELETE) with Bearer auth. */
export const authInit = (method = "GET"): RequestInit => ({
  method,
  headers: authHeaders(),
});

/** Convenience for authenticated GET requests. */
export async function getJson<T>(path: string): Promise<T> {
  return handle<T>(await fetch(apiUrl(path), authInit()));
}
