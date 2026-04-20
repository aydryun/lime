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

test("Deconnexion", async () => {
  const response = await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
  });
  expect(response.status).toBe(200);
});
