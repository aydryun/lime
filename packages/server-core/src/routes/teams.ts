import { Hono } from "hono";

export const teams = new Hono();

// GET /api/teams
teams.get("/", (c) => {
  // TODO: récupérer les équipes en BDD
  return c.json([
    { id: 1, name: "Développeurs" },
    { id: 2, name: "Design" },
  ]);
});

// POST /api/teams
teams.post("/", async (c) => {
  const body = await c.req.json();
  // TODO: créer l'équipe en BDD
  return c.json({ id: 3, name: body.name }, 201);
});

// GET /api/teams/:id
teams.get("/:id", (c) => {
  const id = c.req.param("id");
  // TODO: récupérer l'équipe en BDD
  return c.json({ id: Number(id), name: "Développeurs" });
});

// PUT /api/teams/:id
teams.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  // TODO: modifier l'équipe en BDD
  return c.json({ id: Number(id), name: body.name });
});

// DELETE /api/teams/:id
teams.delete("/:id", (c) => {
  // TODO: supprimer l'équipe en BDD
  return c.json({ message: "Équipe supprimée" });
});

// GET /api/teams/:id/members
teams.get("/:id/members", (c) => {
  // TODO: récupérer les membres en BDD
  return c.json([
    { id: 1, firstname: "Lucas", lastname: "Martin", username: "lucas" },
    { id: 2, firstname: "Julie", lastname: "Dupont", username: "julie" },
  ]);
});

// POST /api/teams/:id/members
teams.post("/:id/members", async (c) => {
  const body = await c.req.json();
  void body;
  // TODO: ajouter le membre en BDD
  return c.json({ message: "Membre ajouté" }, 201);
});

// DELETE /api/teams/:id/members/:userId
teams.delete("/:id/members/:userId", (c) => {
  // TODO: retirer le membre en BDD
  return c.json({ message: "Membre retiré" });
});

// GET /api/teams/:teamId/canaux
teams.get("/:teamId/canaux", (c) => {
  // TODO: récupérer les canaux de l'équipe en BDD
  return c.json([
    { id: 1, name: "général" },
    { id: 2, name: "bugs" },
  ]);
});

// POST /api/teams/:teamId/canaux
teams.post("/:teamId/canaux", async (c) => {
  const body = await c.req.json();
  // TODO: créer le canal en BDD
  return c.json({ id: 3, name: body.name }, 201);
});
