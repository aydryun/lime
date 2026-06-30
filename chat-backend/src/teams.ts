import { Router } from "express";
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  getTeamById,
  getUserOrgRole,
  getUserTeamRole,
  listTeamMembers,
  listTeams,
  listTeamsForMember,
  type PermissionAction,
  removeTeamMember,
  renameTeam,
  userHasPermission,
} from "./database.js";
import { type AuthRequest, authenticate } from "./middleware.js";

const router = Router();

function parseIdParam(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 255) return null;
  return trimmed;
}

/**
 * RBAC team : un rôle org-scopé (org_owner/admin) couvre toutes les teams de
 * l'org, un rôle team-scopé (team_owner/admin/member) couvre la team ciblée.
 */
function canTeam(
  userId: number,
  orgId: number,
  teamId: number | null,
  action: PermissionAction,
): Promise<boolean> {
  return userHasPermission(userId, "team", action, { orgId, teamId });
}

/** Vrai si l'utilisateur gère toutes les teams de l'org (org_owner / org_admin). */
async function isOrgManager(userId: number, orgId: number): Promise<boolean> {
  const role = await getUserOrgRole(userId, orgId);
  return role === "org_owner" || role === "org_admin";
}

/**
 * Un membre simple ne peut consulter qu'une team à laquelle il appartient ;
 * un manager d'org peut consulter toutes les teams de son org.
 */
async function canViewTeam(
  userId: number,
  orgId: number,
  teamId: number,
): Promise<boolean> {
  if (await isOrgManager(userId, orgId)) return true;
  return (await getUserTeamRole(userId, teamId)) !== null;
}

// GET /api/teams — liste des teams de l'org
router.get("/", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  const orgId = req.orgId;
  if (!userId || !orgId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  try {
    // Un manager d'org voit toutes les teams ; un membre simple ne voit que
    // celles auxquelles il appartient (au lieu d'un 403 global).
    const teams = (await isOrgManager(userId, orgId))
      ? await listTeams(orgId)
      : await listTeamsForMember(orgId, userId);
    res.json(teams);
  } catch (error) {
    console.error("List teams error:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des équipes" });
  }
});

// POST /api/teams — crée une team (le créateur devient team_owner)
router.post("/", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  const orgId = req.orgId;
  if (!userId || !orgId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const name = cleanName(req.body?.name);
  if (!name) {
    res.status(400).json({ error: "Nom d'équipe invalide" });
    return;
  }
  try {
    if (!(await canTeam(userId, orgId, null, "CREATE"))) {
      res.status(403).json({ error: "Permission refusée" });
      return;
    }
    const team = await createTeam(orgId, name, userId);
    res.status(201).json(team);
  } catch (error) {
    console.error("Create team error:", error);
    res.status(500).json({ error: "Erreur lors de la création de l'équipe" });
  }
});

// GET /api/teams/:id — détail d'une team + membres
router.get("/:id", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  const orgId = req.orgId;
  if (!userId || !orgId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const teamId = parseIdParam(req.params.id);
  if (!teamId) {
    res.status(400).json({ error: "Identifiant invalide" });
    return;
  }
  try {
    const team = await getTeamById(teamId, orgId);
    if (!team) {
      res.status(404).json({ error: "Équipe introuvable" });
      return;
    }
    if (!(await canViewTeam(userId, orgId, teamId))) {
      res.status(403).json({ error: "Permission refusée" });
      return;
    }
    const members = await listTeamMembers(teamId);
    res.json({ ...team, members });
  } catch (error) {
    console.error("Get team error:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération de l'équipe" });
  }
});

// PATCH /api/teams/:id — renomme une team (team:UPDATE)
router.patch("/:id", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  const orgId = req.orgId;
  if (!userId || !orgId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const teamId = parseIdParam(req.params.id);
  if (!teamId) {
    res.status(400).json({ error: "Identifiant invalide" });
    return;
  }
  const name = cleanName(req.body?.name);
  if (!name) {
    res.status(400).json({ error: "Nom d'équipe invalide" });
    return;
  }
  try {
    const team = await getTeamById(teamId, orgId);
    if (!team) {
      res.status(404).json({ error: "Équipe introuvable" });
      return;
    }
    if (!(await canTeam(userId, orgId, teamId, "UPDATE"))) {
      res.status(403).json({ error: "Permission refusée" });
      return;
    }
    const updated = await renameTeam(teamId, orgId, name);
    res.json(updated);
  } catch (error) {
    console.error("Rename team error:", error);
    res.status(500).json({ error: "Erreur lors du renommage de l'équipe" });
  }
});

// DELETE /api/teams/:id — supprime une team (team:DELETE)
router.delete("/:id", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  const orgId = req.orgId;
  if (!userId || !orgId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const teamId = parseIdParam(req.params.id);
  if (!teamId) {
    res.status(400).json({ error: "Identifiant invalide" });
    return;
  }
  try {
    const team = await getTeamById(teamId, orgId);
    if (!team) {
      res.status(404).json({ error: "Équipe introuvable" });
      return;
    }
    if (!(await canTeam(userId, orgId, teamId, "DELETE"))) {
      res.status(403).json({ error: "Permission refusée" });
      return;
    }
    await deleteTeam(teamId, orgId);
    res.status(204).end();
  } catch (error) {
    console.error("Delete team error:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la suppression de l'équipe" });
  }
});

// GET /api/teams/:id/members — membres d'une team
router.get("/:id/members", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  const orgId = req.orgId;
  if (!userId || !orgId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const teamId = parseIdParam(req.params.id);
  if (!teamId) {
    res.status(400).json({ error: "Identifiant invalide" });
    return;
  }
  try {
    const team = await getTeamById(teamId, orgId);
    if (!team) {
      res.status(404).json({ error: "Équipe introuvable" });
      return;
    }
    if (!(await canViewTeam(userId, orgId, teamId))) {
      res.status(403).json({ error: "Permission refusée" });
      return;
    }
    const members = await listTeamMembers(teamId);
    res.json(members);
  } catch (error) {
    console.error("List team members error:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des membres" });
  }
});

// POST /api/teams/:id/members — ajoute un membre à la team (team:UPDATE)
router.post("/:id/members", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  const orgId = req.orgId;
  if (!userId || !orgId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const teamId = parseIdParam(req.params.id);
  if (!teamId) {
    res.status(400).json({ error: "Identifiant invalide" });
    return;
  }
  const targetId = Number(req.body?.userId);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    res.status(400).json({ error: "userId invalide" });
    return;
  }
  const role = req.body?.role === "team_admin" ? "team_admin" : "team_member";

  try {
    const team = await getTeamById(teamId, orgId);
    if (!team) {
      res.status(404).json({ error: "Équipe introuvable" });
      return;
    }
    if (!(await canTeam(userId, orgId, teamId, "UPDATE"))) {
      res.status(403).json({ error: "Permission refusée" });
      return;
    }
    const result = await addTeamMember(teamId, orgId, targetId, role);
    if (result === "not_in_org") {
      res
        .status(400)
        .json({ error: "Cet utilisateur n'appartient pas à l'organisation" });
      return;
    }
    if (result === "already_member") {
      res.status(409).json({ error: "Déjà membre de l'équipe" });
      return;
    }
    res.status(201).json({ team_id: teamId, user_id: targetId, role });
  } catch (error) {
    console.error("Add team member error:", error);
    res.status(500).json({ error: "Erreur lors de l'ajout du membre" });
  }
});

// DELETE /api/teams/:id/members/:userId — retire un membre (team:UPDATE, ou soi-même)
router.delete(
  "/:id/members/:userId",
  authenticate,
  async (req: AuthRequest, res) => {
    const userId = req.userId;
    const orgId = req.orgId;
    if (!userId || !orgId) {
      res.status(401).json({ error: "Non authentifié" });
      return;
    }
    const teamId = parseIdParam(req.params.id);
    const targetId = parseIdParam(req.params.userId);
    if (!teamId || !targetId) {
      res.status(400).json({ error: "Identifiant invalide" });
      return;
    }
    try {
      const team = await getTeamById(teamId, orgId);
      if (!team) {
        res.status(404).json({ error: "Équipe introuvable" });
        return;
      }
      // On peut se retirer soi-même, sinon il faut la permission team:UPDATE.
      if (
        targetId !== userId &&
        !(await canTeam(userId, orgId, teamId, "UPDATE"))
      ) {
        res.status(403).json({ error: "Permission refusée" });
        return;
      }
      const removed = await removeTeamMember(teamId, targetId);
      if (!removed) {
        res.status(404).json({ error: "Membre introuvable dans l'équipe" });
        return;
      }
      res.status(204).end();
    } catch (error) {
      console.error("Remove team member error:", error);
      res.status(500).json({ error: "Erreur lors du retrait du membre" });
    }
  },
);

export default router;
