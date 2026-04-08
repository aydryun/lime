import { Hono } from "hono";

export const canaux = new Hono();

// GET /api/canaux/:id
canaux.get("/:id", (c) => {
  const id = c.req.param("id");
  // TODO: récupérer le canal en BDD
  return c.json({ id: Number(id), name: "général" });
});

// PUT /api/canaux/:id
canaux.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  // TODO: modifier le canal en BDD
  return c.json({ id: Number(id), name: body.name });
});

// DELETE /api/canaux/:id
canaux.delete("/:id", (c) => {
  // TODO: supprimer le canal en BDD
  return c.json({ message: "Canal supprimé" });
});

// POST /api/canaux/:id/members
canaux.post("/:id/members", async (c) => {
  const body = await c.req.json();
  void body;
  // TODO: ajouter l'utilisateur au canal en BDD
  return c.json({ message: "Utilisateur ajouté au canal" }, 201);
});

// DELETE /api/canaux/:id/members/:userId
canaux.delete("/:id/members/:userId", (c) => {
  // TODO: retirer l'utilisateur du canal en BDD
  return c.json({ message: "Utilisateur retiré du canal" });
});
