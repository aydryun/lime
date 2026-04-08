import { Hono } from "hono";

export const auth = new Hono();

// POST /api/auth/register
auth.post("/register", async (c) => {
  const body = await c.req.json();
  // TODO: créer l'utilisateur en BDD
  return c.json(
    {
      id: 1,
      firstname: body.firstname,
      lastname: body.lastname,
      email: body.email,
      username: body.username,
    },
    201
  );
});

// POST /api/auth/login
auth.post("/login", async (c) => {
  const body = await c.req.json();
  // TODO: vérifier les identifiants, générer un token
  return c.json({
    token: "todo-jwt-token",
    user: {
      id: 1,
      firstname: "Lucas",
      lastname: "Martin",
      email: body.email,
      username: "lucas",
    },
  });
});

// POST /api/auth/logout
auth.post("/logout", (c) => {
  // TODO: invalider le token
  return c.json({ message: "Déconnexion réussie" });
});
