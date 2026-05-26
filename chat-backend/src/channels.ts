import { Router } from "express";
import {
  addChannelMember,
  type CanalRole,
  createChannel,
  deleteChannel,
  findChannelById,
  getChannelMessages,
  getUserChannelRole,
  insertChannelMessage,
  listChannelMembers,
  listNonMembers,
  listUserChannels,
  removeChannelMember,
  renameChannel,
  setChannelRole,
  transferChannelOwnership,
} from "./database.js";
import { type AuthRequest, authenticate } from "./middleware.js";
import { publishMessage } from "./redis.js";

const router = Router();

const MAX_MESSAGE_LENGTH = 4000;

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 255) return null;
  return trimmed;
}

function parseIdParam(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// GET /api/channels — list channels the current user belongs to
router.get("/", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  try {
    const channels = await listUserChannels(userId);
    res.json(channels);
  } catch (error) {
    console.error("List channels error:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des canaux" });
  }
});

// POST /api/channels — create a new channel (creator becomes canal_owner)
router.post("/", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const name = cleanName(req.body?.name);
  if (!name) {
    res.status(400).json({ error: "Nom du canal requis" });
    return;
  }
  try {
    const channel = await createChannel(name, userId);
    res.status(201).json({ ...channel, my_role: "canal_owner" });
  } catch (error) {
    console.error("Create channel error:", error);
    res.status(500).json({ error: "Erreur lors de la création du canal" });
  }
});

// PATCH /api/channels/:id — rename (owner only)
router.patch("/:id", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const id = parseIdParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Identifiant invalide" });
    return;
  }
  const name = cleanName(req.body?.name);
  if (!name) {
    res.status(400).json({ error: "Nom du canal requis" });
    return;
  }
  try {
    const role = await getUserChannelRole(id, userId);
    if (!role) {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }
    if (role !== "canal_owner") {
      res
        .status(403)
        .json({ error: "Seul le propriétaire peut renommer le canal" });
      return;
    }
    const updated = await renameChannel(id, name);
    if (!updated) {
      res.status(404).json({ error: "Canal introuvable" });
      return;
    }
    res.json(updated);
  } catch (error) {
    console.error("Rename channel error:", error);
    res.status(500).json({ error: "Erreur lors de la modification du canal" });
  }
});

// DELETE /api/channels/:id — owner deletes the channel for everyone
router.delete("/:id", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const id = parseIdParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Identifiant invalide" });
    return;
  }
  try {
    const role = await getUserChannelRole(id, userId);
    if (!role) {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }
    if (role !== "canal_owner") {
      res
        .status(403)
        .json({ error: "Seul le propriétaire peut supprimer le canal" });
      return;
    }
    const ok = await deleteChannel(id);
    if (!ok) {
      res.status(404).json({ error: "Canal introuvable" });
      return;
    }
    res.json({ message: "Canal supprimé" });
  } catch (error) {
    console.error("Delete channel error:", error);
    res.status(500).json({ error: "Erreur lors de la suppression du canal" });
  }
});

// GET /api/channels/:id/members — list members with roles
router.get("/:id/members", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const id = parseIdParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Identifiant invalide" });
    return;
  }
  try {
    const role = await getUserChannelRole(id, userId);
    if (!role) {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }
    const members = await listChannelMembers(id);
    res.json(members);
  } catch (error) {
    console.error("List members error:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des membres" });
  }
});

// GET /api/channels/:id/non-members?q=... — users not in the channel (member picker)
router.get("/:id/non-members", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const id = parseIdParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Identifiant invalide" });
    return;
  }
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  try {
    const role = await getUserChannelRole(id, userId);
    if (!role || role === "canal_member") {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }
    const users = await listNonMembers(id, q);
    res.json(users);
  } catch (error) {
    console.error("List non-members error:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la recherche d'utilisateurs" });
  }
});

// POST /api/channels/:id/members — add a member (owner or admin)
router.post("/:id/members", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const id = parseIdParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Identifiant invalide" });
    return;
  }
  const targetId =
    typeof req.body?.userId === "number" ? req.body.userId : null;
  if (!targetId) {
    res.status(400).json({ error: "userId requis" });
    return;
  }
  try {
    const role = await getUserChannelRole(id, userId);
    if (!role || role === "canal_member") {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }
    const channel = await findChannelById(id);
    if (!channel) {
      res.status(404).json({ error: "Canal introuvable" });
      return;
    }
    const added = await addChannelMember(id, targetId);
    res.status(added ? 201 : 200).json({ added });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: string }).code
        : undefined;
    if (code === "23503") {
      res.status(404).json({ error: "Utilisateur introuvable" });
      return;
    }
    console.error("Add member error:", error);
    res.status(500).json({ error: "Erreur lors de l'ajout du membre" });
  }
});

// PATCH /api/channels/:id/members/:userId — promote / demote (owner only)
router.patch(
  "/:id/members/:userId",
  authenticate,
  async (req: AuthRequest, res) => {
    const callerId = req.userId;
    if (!callerId) {
      res.status(401).json({ error: "Non authentifié" });
      return;
    }
    const id = parseIdParam(req.params.id);
    const targetId = parseIdParam(req.params.userId);
    if (!id || !targetId) {
      res.status(400).json({ error: "Identifiant invalide" });
      return;
    }
    const role = req.body?.role as CanalRole | undefined;
    if (role !== "canal_admin" && role !== "canal_member") {
      res
        .status(400)
        .json({ error: "Rôle attendu: canal_admin ou canal_member" });
      return;
    }
    try {
      const callerRole = await getUserChannelRole(id, callerId);
      if (callerRole !== "canal_owner") {
        res
          .status(403)
          .json({ error: "Seul le propriétaire peut changer les rôles" });
        return;
      }
      const targetRole = await getUserChannelRole(id, targetId);
      if (!targetRole) {
        res.status(404).json({ error: "Membre introuvable" });
        return;
      }
      if (targetRole === "canal_owner") {
        res
          .status(409)
          .json({ error: "Impossible de changer le rôle du propriétaire" });
        return;
      }
      await setChannelRole(id, targetId, role);
      res.json({ role });
    } catch (error) {
      console.error("Set role error:", error);
      res.status(500).json({ error: "Erreur lors du changement de rôle" });
    }
  },
);

// POST /api/channels/:id/transfer — transfer ownership to userId, current owner leaves
router.post("/:id/transfer", authenticate, async (req: AuthRequest, res) => {
  const callerId = req.userId;
  if (!callerId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const id = parseIdParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Identifiant invalide" });
    return;
  }
  const newOwnerId =
    typeof req.body?.userId === "number" ? req.body.userId : null;
  if (!newOwnerId || newOwnerId === callerId) {
    res.status(400).json({ error: "Nouveau propriétaire invalide" });
    return;
  }
  try {
    const callerRole = await getUserChannelRole(id, callerId);
    if (callerRole !== "canal_owner") {
      res
        .status(403)
        .json({ error: "Seul le propriétaire peut transférer le canal" });
      return;
    }
    const targetRole = await getUserChannelRole(id, newOwnerId);
    if (!targetRole) {
      res.status(404).json({ error: "Utilisateur cible non membre" });
      return;
    }
    await transferChannelOwnership(id, callerId, newOwnerId);
    res.json({ message: "Propriété transférée" });
  } catch (error) {
    console.error("Transfer error:", error);
    res.status(500).json({ error: "Erreur lors du transfert" });
  }
});

// DELETE /api/channels/:id/members/:userId — remove a member (rules below)
router.delete(
  "/:id/members/:userId",
  authenticate,
  async (req: AuthRequest, res) => {
    const callerId = req.userId;
    if (!callerId) {
      res.status(401).json({ error: "Non authentifié" });
      return;
    }
    const id = parseIdParam(req.params.id);
    const targetId = parseIdParam(req.params.userId);
    if (!id || !targetId) {
      res.status(400).json({ error: "Identifiant invalide" });
      return;
    }
    try {
      const callerRole = await getUserChannelRole(id, callerId);
      if (!callerRole) {
        res.status(403).json({ error: "Accès refusé" });
        return;
      }
      const targetRole = await getUserChannelRole(id, targetId);
      if (!targetRole) {
        res.status(404).json({ error: "Membre introuvable" });
        return;
      }
      const isSelf = callerId === targetId;
      if (isSelf) {
        // Leaving: an owner can't leave without transferring or deleting first
        // (only if there are other canal_* members).
        if (callerRole === "canal_owner") {
          const members = await listChannelMembers(id);
          if (members.some((m) => m.user_id !== callerId)) {
            res.status(409).json({
              error:
                "Transférez la propriété ou supprimez le canal avant de partir",
              code: "OWNER_HAS_MEMBERS",
            });
            return;
          }
          // Owner alone — leaving means deleting the channel.
          await deleteChannel(id);
          res.json({ message: "Canal supprimé" });
          return;
        }
      } else {
        // Removing someone else: owner can remove anyone; admin only canal_member.
        if (callerRole === "canal_member") {
          res.status(403).json({ error: "Accès refusé" });
          return;
        }
        if (callerRole === "canal_admin" && targetRole !== "canal_member") {
          res.status(403).json({
            error: "Un admin ne peut retirer que des membres",
          });
          return;
        }
        if (targetRole === "canal_owner") {
          res
            .status(409)
            .json({ error: "Impossible de retirer le propriétaire" });
          return;
        }
      }
      const removed = await removeChannelMember(id, targetId);
      if (!removed) {
        res.status(404).json({ error: "Membre introuvable" });
        return;
      }
      res.json({ message: "Membre retiré" });
    } catch (error) {
      console.error("Remove member error:", error);
      res.status(500).json({ error: "Erreur lors du retrait du membre" });
    }
  },
);

// GET /api/channels/:id/messages — list channel messages
router.get("/:id/messages", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const id = parseIdParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Identifiant invalide" });
    return;
  }
  try {
    const role = await getUserChannelRole(id, userId);
    if (!role) {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }
    const messages = await getChannelMessages(id);
    res.json(messages);
  } catch (error) {
    console.error("List messages error:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des messages" });
  }
});

// POST /api/channels/:id/messages — post a message in a channel
router.post("/:id/messages", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const id = parseIdParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Identifiant invalide" });
    return;
  }
  const content =
    typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!content) {
    res.status(400).json({ error: "Contenu du message requis" });
    return;
  }
  if (content.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({
      error: `Le message ne peut pas dépasser ${MAX_MESSAGE_LENGTH} caractères`,
    });
    return;
  }
  try {
    const role = await getUserChannelRole(id, userId);
    if (!role) {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }
    const message = await insertChannelMessage(id, userId, content);
    await publishMessage("messages", message);
    res.status(201).json(message);
  } catch (error) {
    console.error("Post message error:", error);
    res.status(500).json({ error: "Erreur lors de l'envoi du message" });
  }
});

export default router;
