import { test, expect } from "bun:test";
import { fetch } from "bun";

const API_URL = "http://localhost:3001/api";

// api/login
test("Identifiants invalides", async () => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "lucas@lime.app",
      password: "mauvais_mdp",
    }),
  });
  expect(response.status).toBe(401);
});

test("Mot de passe manquant", async () => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "lucas@lime.app",
    }),
  });
  expect(response.status).toBe(400);
});

test("Succès de connexion", async () => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "lucas@lime.app",
      password: "password123",
    }),
  });
  expect(response.status).toBe(200);
});

// api/logout

test("Token manquant", async () => {
  const response = await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  expect(response.status).toBe(401);
});

test("Deconnexion", async () => {
  const login = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "lucas@lime.app",
      password: "password123",
    }),
  });
  const { token } = (await login.json()) as { token: string };

  const response = await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  expect(response.status).toBe(200);
});