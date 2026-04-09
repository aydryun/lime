import { Hono } from "hono";

export const users = new Hono();

// GET /api/users/:id
users.get("/:id", (c) => {
  const id = c.req.param("id");
  // TODO: récupérer l'utilisateur en BDD
  return c.json({
    id: Number(id),
    firstname: "Lucas",
    lastname: "Martin",
    email: "lucas@lime.app",
    username: "lucas",
  });
});

// PUT /api/users/:id
users.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  // TODO: modifier l'utilisateur en BDD
  return c.json({
    id: Number(id),
    firstname: body.firstname,
    lastname: body.lastname,
    email: "lucas@lime.app",
    username: body.username,
  });
});

// DELETE /api/users/:id
users.delete("/:id", (c) => {
  // TODO: supprimer l'utilisateur en BDD
  return c.json({ message: "Utilisateur supprimé" });
});

// POST /api/users/:id/roles — assigner un rôle
users.post("/:id/roles", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  // TODO: assigner le rôle en BDD
  return c.json(
    {
      idUser: Number(id),
      idRole: body.idRole,
      idTeam: body.idTeam,
      idCanaux: body.idCanaux,
    },
    201
  );
});

// DELETE /api/users/:id/roles/:roleId
users.delete("/:id/roles/:roleId", (c) => {
  // TODO: retirer le rôle en BDD
  return c.json({ message: "Rôle retiré" });
});
