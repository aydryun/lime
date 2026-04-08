import { Hono } from "hono";

export const messages = new Hono();

// PUT /api/messages/:id
messages.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  // TODO: modifier le message en BDD
  return c.json({
    id: Number(id),
    idCanaux: 1,
    idUser: 1,
    content: body.content,
    isUpdated: true,
    isPinned: false,
    createdAt: new Date().toISOString(),
  });
});

// DELETE /api/messages/:id
messages.delete("/:id", (c) => {
  // TODO: supprimer le message en BDD
  return c.json({ message: "Message supprimé" });
});

// PUT /api/messages/:id/pin
messages.put("/:id/pin", (c) => {
  const id = c.req.param("id");
  // TODO: toggle pin en BDD
  return c.json({
    id: Number(id),
    idCanaux: 1,
    idUser: 1,
    content: "Message",
    isUpdated: false,
    isPinned: true,
    createdAt: new Date().toISOString(),
  });
});

// GET /api/messages/:id/reactions
messages.get("/:id/reactions", (c) => {
  // TODO: récupérer les réactions en BDD
  return c.json([
    { idUser: 1, reaction: "👍" },
    { idUser: 2, reaction: "🎉" },
  ]);
});

// POST /api/messages/:id/reactions
messages.post("/:id/reactions", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  // TODO: ajouter la réaction en BDD
  return c.json(
    { idMessage: Number(id), idUser: 1, reaction: body.reaction },
    201
  );
});

// DELETE /api/messages/:id/reactions
messages.delete("/:id/reactions", (c) => {
  // TODO: retirer la réaction en BDD
  return c.json({ message: "Réaction retirée" });
});

// GET /api/messages/:id/documents
messages.get("/:id/documents", (c) => {
  // TODO: récupérer les documents du message en BDD
  return c.json([]);
});
