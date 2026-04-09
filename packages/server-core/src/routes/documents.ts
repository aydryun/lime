import { Hono } from "hono";

export const documents = new Hono();

// DELETE /api/documents/:id
documents.delete("/:id", (c) => {
  // TODO: supprimer le document en BDD
  return c.json({ message: "Document supprimé" });
});
