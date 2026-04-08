import { Hono } from "hono";

export const roles = new Hono();

// GET /api/roles
roles.get("/", (c) => {
  // TODO: récupérer les rôles en BDD
  return c.json([
    { id: 1, name: "Admin", isAdmin: true, isSuperAdmin: false },
    { id: 2, name: "Membre", isAdmin: false, isSuperAdmin: false },
  ]);
});

// POST /api/roles
roles.post("/", async (c) => {
  const body = await c.req.json();
  // TODO: créer le rôle en BDD
  return c.json(
    {
      id: 3,
      name: body.name,
      isAdmin: body.isAdmin ?? false,
      isSuperAdmin: body.isSuperAdmin ?? false,
    },
    201
  );
});

// PUT /api/roles/:id
roles.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  // TODO: modifier le rôle en BDD
  return c.json({
    id: Number(id),
    name: body.name,
    isAdmin: body.isAdmin ?? false,
    isSuperAdmin: body.isSuperAdmin ?? false,
  });
});

// DELETE /api/roles/:id
roles.delete("/:id", (c) => {
  // TODO: supprimer le rôle en BDD
  return c.json({ message: "Rôle supprimé" });
});

// GET /api/permissions
roles.get("/permissions", (c) => {
  // TODO: récupérer les permissions en BDD
  return c.json([
    { id: 1, category: "message", action: "delete" },
    { id: 2, category: "canaux", action: "create" },
    { id: 3, category: "team", action: "modify" },
  ]);
});

// POST /api/roles/:id/permissions
roles.post("/:id/permissions", async (c) => {
  const body = await c.req.json();
  void body;
  // TODO: assigner la permission en BDD
  return c.json({ message: "Permission assignée" }, 201);
});

// DELETE /api/roles/:id/permissions/:permId
roles.delete("/:id/permissions/:permId", (c) => {
  // TODO: retirer la permission en BDD
  return c.json({ message: "Permission retirée" });
});
