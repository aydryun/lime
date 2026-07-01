import { describe, expect, test } from "bun:test";
import { fetch } from "bun";
import jwt from "jsonwebtoken";
import { API_URL, fixtures } from "./helpers.js";

const JWT_SECRET = process.env.JWT_SECRET as string;

function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /auth/register", () => {
  test("crée un compte + son organisation (201)", async () => {
    const res = await post("/auth/register", {
      firstname: "New",
      lastname: "Comer",
      email: "newbie@register.test",
      username: "newbie",
      password: "password123",
      organisation: "New Corp",
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: number;
      org_id: number;
      email: string;
    };
    expect(body.email).toBe("newbie@register.test");
    // Un nouveau compte devient owner de sa propre org (frontière tenant).
    expect(typeof body.org_id).toBe("number");
  });

  test("refuse les champs manquants (400)", async () => {
    const res = await post("/auth/register", {
      email: "incomplete@register.test",
      password: "password123",
    });
    expect(res.status).toBe(400);
  });

  test("refuse un email déjà utilisé (409)", async () => {
    const res = await post("/auth/register", {
      firstname: "Dup",
      lastname: "Licate",
      email: fixtures.users.julie.email,
      username: "dupjulie",
      password: "password123",
    });
    expect(res.status).toBe(409);
  });
});

describe("POST /auth/login", () => {
  test("succès avec identifiants valides (200)", async () => {
    const res = await post("/auth/login", {
      email: fixtures.users.admin.email,
      password: fixtures.adminPassword,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      token: string;
      user: { org_id: number };
    };
    expect(typeof body.token).toBe("string");
    expect(body.user.org_id).toBe(fixtures.org.id);
  });

  test("mot de passe invalide (401)", async () => {
    const res = await post("/auth/login", {
      email: fixtures.users.admin.email,
      password: "mauvais_mdp",
    });
    expect(res.status).toBe(401);
  });

  test("email inconnu (401)", async () => {
    const res = await post("/auth/login", {
      email: "inconnu@nowhere.test",
      password: "password123",
    });
    expect(res.status).toBe(401);
  });

  test("mot de passe manquant (400)", async () => {
    const res = await post("/auth/login", {
      email: fixtures.users.admin.email,
    });
    expect(res.status).toBe(400);
  });

  // NB : ce test doit passer AVANT le parcours d'activation ci-dessous, qui
  // active définitivement ce même compte.
  test("compte non activé refusé (403)", async () => {
    const res = await post("/auth/login", {
      email: fixtures.users.pending.email,
      password: fixtures.password,
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /auth/logout", () => {
  test("sans token (401)", async () => {
    const res = await post("/auth/logout", {});
    expect(res.status).toBe(401);
  });

  test("token invalide (401)", async () => {
    const res = await post(
      "/auth/logout",
      {},
      { Authorization: "Bearer pas.un.jwt" },
    );
    expect(res.status).toBe(401);
  });

  test("avec un token valide (200)", async () => {
    const login = await post("/auth/login", {
      email: fixtures.users.admin.email,
      password: fixtures.adminPassword,
    });
    const { token } = (await login.json()) as { token: string };
    const res = await post(
      "/auth/logout",
      {},
      { Authorization: `Bearer ${token}` },
    );
    expect(res.status).toBe(200);
  });
});

describe("POST /auth/activate", () => {
  test("token/mot de passe manquants (400)", async () => {
    const res = await post("/auth/activate", { token: "abc" });
    expect(res.status).toBe(400);
  });

  test("mot de passe trop court (400)", async () => {
    const token = jwt.sign(
      { userId: fixtures.users.pending.id, purpose: "activation" },
      JWT_SECRET,
    );
    const res = await post("/auth/activate", { token, password: "court" });
    expect(res.status).toBe(400);
  });

  test("token illisible (401)", async () => {
    const res = await post("/auth/activate", {
      token: "pas.un.jwt",
      password: "password123",
    });
    expect(res.status).toBe(401);
  });

  test("token au mauvais purpose (401)", async () => {
    const token = jwt.sign(
      { userId: fixtures.users.pending.id, purpose: "login" },
      JWT_SECRET,
    );
    const res = await post("/auth/activate", {
      token,
      password: "password123",
    });
    expect(res.status).toBe(401);
  });

  test("cycle complet : activation puis connexion (200)", async () => {
    const token = jwt.sign(
      { userId: fixtures.users.pending.id, purpose: "activation" },
      JWT_SECRET,
    );
    const activate = await post("/auth/activate", {
      token,
      password: "nouveaumotdepasse",
    });
    expect(activate.status).toBe(200);

    // Le compte est désormais activé : la connexion réussit.
    const login = await post("/auth/login", {
      email: fixtures.users.pending.email,
      password: "nouveaumotdepasse",
    });
    expect(login.status).toBe(200);
  });
});
