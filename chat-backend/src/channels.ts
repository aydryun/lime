import { Router } from "express";
import {
  addChannelMember,
  type CanalRole,
  type ChannelAddSpec,
  canManageUser,
  createChannel,
  type DefaultCanalRole,
  deleteChannel,
  findChannelById,
  getChannelMessages,
  getTeamById,
  getUserChannelRole,
  insertChannelMessage,
  listChannelMembers,
  listNonMembers,
  listUserChannels,
  removeChannelMember,
  renameChannel,
  setChannelRole,
  transferChannelOwnership,
  userHasPermission,
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

const DEFAULT_CANAL_ROLES: DefaultCanalRole[] = [
  "canal_admin",
  "canal_member",
  "canal_reader",
];

/** Lit le rôle par défaut du body (canal_member si absent), ou null si invalide. */
function parseDefaultRole(value: unknown): DefaultCanalRole | null {
  if (value === undefined || value === null) return "canal_member";
  if (
    typeof value === "string" &&
    (DEFAULT_CANAL_ROLES as string[]).includes(value)
  ) {
    return value as DefaultCanalRole;
  }
  return null;
}

// GET /api/channels — list channels the current user belongs to
router.get("/", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  const orgId = req.orgId;
  if (!userId || !orgId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  try {
    const channels = await listUserChannels(userId, orgId);
    res.json(channels);
  } catch (error) {
    console.error("List channels error:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des canaux" });
  }
});

// POST /api/channels — crée un canal (le créateur devient canal_owner).
// Le peuplement initial est scopé par "mode" :
//   - "org"          : tout l'org — réservé aux managers d'org (channel:CREATE org) ;
//   - "team"/"team_subtree" : l'équipe (et son sous-arbre) — l'appelant doit gérer
//                      cette team (channel:CREATE en cascade) ;
//   - "members"      : des utilisateurs précis — chacun doit être sous l'autorité
//                      de l'appelant (canManageUser) ;
//   - "private" / absent : seulement le créateur (ouvert à tout authentifié).
router.post("/", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  const orgId = req.orgId;
  if (!userId || !orgId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const name = cleanName(req.body?.name);
  if (!name) {
    res.status(400).json({ error: "Nom du canal requis" });
    return;
  }
  const mode = (req.body?.mode as string | undefined) ?? "private";
  const defaultRole = parseDefaultRole(req.body?.default_role);
  if (defaultRole === null) {
    res.status(400).json({ error: "default_role invalide" });
    return;
  }

  try {
    let spec: ChannelAddSpec;
    if (mode === "private") {
      spec = { mode: "private" };
    } else if (mode === "org") {
      // Org-wide : exige channel:CREATE au scope org (managers d'org uniquement).
      if (!(await userHasPermission(userId, "channel", "CREATE", { orgId }))) {
        res.status(403).json({
          error: "Seul un manager d'organisation peut créer un canal org-wide",
        });
        return;
      }
      spec = { mode: "org", defaultRole };
    } else if (mode === "team" || mode === "team_subtree") {
      const teamId = parseIdParam(String(req.body?.team_id));
      if (!teamId) {
        res.status(400).json({ error: "team_id invalide" });
        return;
      }
      const team = await getTeamById(teamId, orgId);
      if (!team) {
        res.status(404).json({ error: "Équipe introuvable" });
        return;
      }
      // L'appelant doit gérer cette team (cascade) ou être manager d'org.
      if (
        !(await userHasPermission(userId, "channel", "CREATE", {
          orgId,
          teamId,
        }))
      ) {
        res.status(403).json({ error: "Permission refusée sur cette équipe" });
        return;
      }
      spec = { mode, teamId, defaultRole };
    } else if (mode === "members") {
      const raw = req.body?.user_ids;
      if (!Array.isArray(raw) || raw.length === 0) {
        res.status(400).json({ error: "user_ids requis" });
        return;
      }
      const userIds: number[] = [];
      for (const v of raw) {
        const id = typeof v === "number" ? v : parseIdParam(String(v));
        if (!id) {
          res.status(400).json({ error: "user_ids invalide" });
          return;
        }
        userIds.push(id);
      }
      // Chaque cible doit être sous l'autorité de l'appelant.
      for (const targetId of userIds) {
        if (!(await canManageUser(userId, orgId, targetId))) {
          res.status(403).json({
            error: "Un utilisateur ciblé n'est pas dans votre périmètre",
          });
          return;
        }
      }
      spec = { mode: "members", userIds, defaultRole };
    } else {
      res.status(400).json({ error: "mode invalide" });
      return;
    }

    const channel = await createChannel(name, userId, orgId, spec);
    res.status(201).json({ ...channel, my_role: "canal_owner" });
  } catch (error) {
    console.error("Create channel error:", error);
    res.status(500).json({ error: "Erreur lors de la création du canal" });
  }
});

// PATCH /api/channels/:id — rename (owner only)
router.patch("/:id", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  const orgId = req.orgId;
  if (!userId || !orgId) {
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
    const role = await getUserChannelRole(id, userId, orgId);
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
  const orgId = req.orgId;
  if (!userId || !orgId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const id = parseIdParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Identifiant invalide" });
    return;
  }
  try {
    const role = await getUserChannelRole(id, userId, orgId);
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
  const orgId = req.orgId;
  if (!userId || !orgId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const id = parseIdParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Identifiant invalide" });
    return;
  }
  try {
    const role = await getUserChannelRole(id, userId, orgId);
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
  const orgId = req.orgId;
  if (!userId || !orgId) {
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
    const role = await getUserChannelRole(id, userId, orgId);
    if (role !== "canal_owner" && role !== "canal_admin") {
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
  const orgId = req.orgId;
  if (!userId || !orgId) {
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
    const role = await getUserChannelRole(id, userId, orgId);
    if (role !== "canal_owner" && role !== "canal_admin") {
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
    const orgId = req.orgId;
    if (!callerId || !orgId) {
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
    if (
      role !== "canal_admin" &&
      role !== "canal_member" &&
      role !== "canal_reader"
    ) {
      res.status(400).json({
        error: "Rôle attendu: canal_admin, canal_member ou canal_reader",
      });
      return;
    }
    try {
      const callerRole = await getUserChannelRole(id, callerId, orgId);
      if (callerRole !== "canal_owner") {
        res
          .status(403)
          .json({ error: "Seul le propriétaire peut changer les rôles" });
        return;
      }
      const targetRole = await getUserChannelRole(id, targetId, orgId);
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
  const orgId = req.orgId;
  if (!callerId || !orgId) {
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
    const callerRole = await getUserChannelRole(id, callerId, orgId);
    if (callerRole !== "canal_owner") {
      res
        .status(403)
        .json({ error: "Seul le propriétaire peut transférer le canal" });
      return;
    }
    const targetRole = await getUserChannelRole(id, newOwnerId, orgId);
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
    const orgId = req.orgId;
    if (!callerId || !orgId) {
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
      const callerRole = await getUserChannelRole(id, callerId, orgId);
      if (!callerRole) {
        res.status(403).json({ error: "Accès refusé" });
        return;
      }
      const targetRole = await getUserChannelRole(id, targetId, orgId);
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
        if (callerRole !== "canal_owner" && callerRole !== "canal_admin") {
          res.status(403).json({ error: "Accès refusé" });
          return;
        }
        if (callerRole === "canal_admin" && targetRole === "canal_admin") {
          res.status(403).json({
            error: "Un admin ne peut pas retirer un autre admin",
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
  const orgId = req.orgId;
  if (!userId || !orgId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const id = parseIdParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Identifiant invalide" });
    return;
  }
  try {
    const role = await getUserChannelRole(id, userId, orgId);
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
  const orgId = req.orgId;
  if (!userId || !orgId) {
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
    const role = await getUserChannelRole(id, userId, orgId);
    if (!role) {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }
    if (role === "canal_reader") {
      res
        .status(403)
        .json({ error: "Lecture seule : vous ne pouvez pas écrire ici" });
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
