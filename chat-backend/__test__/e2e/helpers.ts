import { fetch } from "bun";

/** Base de l'API sous test (le port vient de .env.test, chargé par Bun). */
export const API_URL = `http://localhost:${process.env.PORT}/api`;

// Fixtures produites par __test__/setup/init-db.ts (via seed({reset:true})).
const FIXTURES_PATH = new URL("../fixtures.json", import.meta.url).pathname;

export interface Fixtures {
  password: string;
  adminPassword: string;
  org: { id: number };
  users: Record<string, { id: number; email: string }>;
  teams: { root: number; dev: number };
  channels: { general: number; random: number; dev: number };
  beta: {
    org: { id: number };
    users: Record<string, { id: number; email: string }>;
    teams: { root: number };
    channels: { private: number };
  };
}

export const fixtures: Fixtures = await Bun.file(FIXTURES_PATH).json();

/** Connecte un utilisateur et renvoie son JWT (jette si l'auth échoue). */
export async function login(
  email: string,
  password: string = fixtures.password,
): Promise<string> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) {
    throw new Error(`login(${email}) a échoué : ${res.status}`);
  }
  const { token } = (await res.json()) as { token: string };
  return token;
}

/** Raccourcis de connexion pour les profils de la fixture. */
export const as = {
  owner: () => login(fixtures.users.admin.email, fixtures.adminPassword), // org_owner
  admin: () => login(fixtures.users.julie.email), // org_admin
  member: () => login(fixtures.users.lucas.email), // member simple
  beta: () => login(fixtures.beta.users.mallory.email), // org_owner de Beta
};

/** Émet une requête authentifiée par Bearer sur l'API. */
export function api(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

/** Sérialise un corps JSON pour `api()`. */
export function json(body: unknown): string {
  return JSON.stringify(body);
}
