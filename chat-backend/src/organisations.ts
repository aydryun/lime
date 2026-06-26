import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { createActivationToken } from "./auth.js";
import {
  createOrgMember,
  DuplicateError,
  getOrganisationById,
  getUserOrgRole,
  listOrgMembers,
  ORG_UPDATABLE_FIELDS,
  type OrgUpdatableField,
  type PermissionAction,
  removeOrgMember,
  setOrgMemberRole,
  updateOrganisation,
  userHasPermission,
} from "./database.js";
import { sendInvitationEmail } from "./email.js";
import { type AuthRequest, authenticate } from "./middleware.js";

const router = Router();

export function parseIdParam(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

/** Resolves the authenticated caller, or sends 401 and returns null. */
function authContext(
  req: AuthRequest,
  res: import("express").Response,
): { userId: number; orgId: number } | null {
  const userId = req.userId;
  const orgId = req.orgId;
  if (!userId || !orgId) {
    res.status(401).json({ error: "Non authentifié" });
    return null;
  }
  return { userId, orgId };
}

/**
 * RBAC : exige la permission (category, action) à l'échelle de l'org.
 * Envoie 401/403 et renvoie null si refusé.
 */
export async function requirePerm(
  req: AuthRequest,
  res: import("express").Response,
  category: string,
  action: PermissionAction,
): Promise<{ userId: number; orgId: number } | null> {
  const ctx = authContext(req, res);
  if (!ctx) return null;
  const allowed = await userHasPermission(ctx.userId, category, action, {
    orgId: ctx.orgId,
  });
  if (!allowed) {
    res.status(403).json({ error: "Permission refusée" });
    return null;
  }
  return ctx;
}

// Longueurs max alignées sur le schéma (migration 016).
const FIELD_MAX: Record<OrgUpdatableField, number> = {
  nom: 255,
  raison_sociale: 255,
  siren: 9,
  siret: 14,
  tva_intracommunautaire: 13,
  email: 255,
  telephone: 32,
  adresse: 255,
  code_postal: 16,
  ville: 255,
  pays: 255,
};

/** Validates the PATCH body; returns the cleaned fields or an error message. */
function validateOrgFields(
  body: Record<string, unknown>,
):
  | { fields: Partial<Record<OrgUpdatableField, string | null>> }
  | { error: string } {
  const fields: Partial<Record<OrgUpdatableField, string | null>> = {};
  for (const key of ORG_UPDATABLE_FIELDS) {
    if (!(key in body)) continue;
    const raw = body[key];

    // null/"" efface le champ (sauf nom qui reste obligatoire).
    if (raw === null || raw === "") {
      if (key === "nom")
        return { error: "Le nom de l'organisation est requis" };
      fields[key] = null;
      continue;
    }
    if (typeof raw !== "string") return { error: `Champ ${key} invalide` };
    const value = raw.trim();
    if (value.length > FIELD_MAX[key]) {
      return { error: `Champ ${key} trop long (max ${FIELD_MAX[key]})` };
    }
    if (key === "siren" && !/^\d{9}$/.test(value)) {
      return { error: "Le SIREN doit comporter 9 chiffres" };
    }
    if (key === "siret" && !/^\d{14}$/.test(value)) {
      return { error: "Le SIRET doit comporter 14 chiffres" };
    }
    if (key === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      return { error: "Email de contact invalide" };
    }
    fields[key] = value;
  }
  return { fields };
}

// GET /api/org — infos de l'organisation courante
router.get("/", authenticate, async (req: AuthRequest, res) => {
  const orgId = req.orgId;
  if (!orgId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  try {
    const org = await getOrganisationById(orgId);
    if (!org) {
      res.status(404).json({ error: "Organisation introuvable" });
      return;
    }
    res.json(org);
  } catch (error) {
    console.error("Get org error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération" });
  }
});

// PATCH /api/org — met à jour les infos entreprise (owner/admin)
router.patch("/", authenticate, async (req: AuthRequest, res) => {
  const ctx = await requirePerm(req, res, "org", "UPDATE");
  if (!ctx) return;

  const validated = validateOrgFields(req.body ?? {});
  if ("error" in validated) {
    res.status(400).json({ error: validated.error });
    return;
  }
  if (Object.keys(validated.fields).length === 0) {
    res.status(400).json({ error: "Aucun champ à mettre à jour" });
    return;
  }
  try {
    const org = await updateOrganisation(ctx.orgId, validated.fields);
    if (!org) {
      res.status(404).json({ error: "Organisation introuvable" });
      return;
    }
    res.json(org);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({
        error:
          "Ce SIREN ou cet email est déjà utilisé par une autre organisation",
      });
      return;
    }
    console.error("Update org error:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

// GET /api/org/members — liste des membres de l'org (tout membre authentifié :
// nécessaire aux sélecteurs d'utilisateurs, p. ex. ajout à une équipe).
router.get("/members", authenticate, async (req: AuthRequest, res) => {
  const ctx = authContext(req, res);
  if (!ctx) return;
  try {
    const members = await listOrgMembers(ctx.orgId);
    res.json(members);
  } catch (error) {
    console.error("List org members error:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des membres" });
  }
});

// POST /api/org/members — crée un membre dans l'org et envoie l'email d'activation
router.post("/members", authenticate, async (req: AuthRequest, res) => {
  const ctx = await requirePerm(req, res, "member", "CREATE");
  if (!ctx) return;

  const firstname = cleanString(req.body?.firstname, 255);
  const lastname = cleanString(req.body?.lastname, 255);
  const username = cleanString(req.body?.username, 255);
  const emailRaw = cleanString(req.body?.email, 255);
  const role = req.body?.role === "org_admin" ? "org_admin" : "member";

  if (!firstname || !lastname || !username || !emailRaw) {
    res
      .status(400)
      .json({ error: "firstname, lastname, username et email sont requis" });
    return;
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailRaw)) {
    res.status(400).json({ error: "Email invalide" });
    return;
  }

  try {
    // Mot de passe aléatoire inutilisable : le membre le définit via l'email d'activation.
    const randomPassword = randomBytes(24).toString("hex");
    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    const member = await createOrgMember({
      orgId: ctx.orgId,
      firstname,
      lastname,
      email: emailRaw,
      username,
      hashedPassword,
      role,
    });

    const org = await getOrganisationById(ctx.orgId);
    const token = createActivationToken(member.id);
    let emailSent = true;
    try {
      await sendInvitationEmail({
        to: member.email,
        firstname: member.firstname,
        organisationName: org?.nom ?? "votre organisation",
        token,
      });
    } catch (mailError) {
      emailSent = false;
      console.error("Invitation email error:", mailError);
    }

    res.status(201).json({ ...member, role, emailSent });
  } catch (error) {
    if (error instanceof DuplicateError) {
      const msg =
        error.field === "email"
          ? "Cet email est déjà utilisé"
          : "Ce nom d'utilisateur est déjà pris dans l'organisation";
      res.status(409).json({ error: msg });
      return;
    }
    console.error("Create org member error:", error);
    res.status(500).json({ error: "Erreur lors de la création du membre" });
  }
});

// PATCH /api/org/members/:userId — change le rôle d'un membre (member:UPDATE)
router.patch(
  "/members/:userId",
  authenticate,
  async (req: AuthRequest, res) => {
    const ctx = await requirePerm(req, res, "member", "UPDATE");
    if (!ctx) return;

    const targetId = parseIdParam(req.params.userId);
    if (!targetId) {
      res.status(400).json({ error: "Identifiant invalide" });
      return;
    }
    const role = req.body?.role;
    if (role !== "org_admin" && role !== "member") {
      res.status(400).json({ error: "Rôle invalide (org_admin ou member)" });
      return;
    }

    const targetRole = await getUserOrgRole(targetId, ctx.orgId);
    if (targetRole === "org_owner") {
      res.status(403).json({
        error: "Le rôle du propriétaire ne peut pas être modifié ici",
      });
      return;
    }

    try {
      const ok = await setOrgMemberRole(targetId, ctx.orgId, role);
      if (!ok) {
        res.status(404).json({ error: "Membre introuvable" });
        return;
      }
      res.json({ id: targetId, role });
    } catch (error) {
      console.error("Set member role error:", error);
      res.status(500).json({ error: "Erreur lors du changement de rôle" });
    }
  },
);

// DELETE /api/org/members/:userId — retire un membre de l'org (member:DELETE)
router.delete(
  "/members/:userId",
  authenticate,
  async (req: AuthRequest, res) => {
    const ctx = await requirePerm(req, res, "member", "DELETE");
    if (!ctx) return;

    const targetId = parseIdParam(req.params.userId);
    if (!targetId) {
      res.status(400).json({ error: "Identifiant invalide" });
      return;
    }
    if (targetId === ctx.userId) {
      res
        .status(400)
        .json({ error: "Vous ne pouvez pas vous retirer vous-même" });
      return;
    }
    const targetRole = await getUserOrgRole(targetId, ctx.orgId);
    if (targetRole === "org_owner") {
      res
        .status(403)
        .json({ error: "Le propriétaire ne peut pas être retiré" });
      return;
    }

    try {
      const result = await removeOrgMember(targetId, ctx.orgId);
      if (result === "not_found") {
        res.status(404).json({ error: "Membre introuvable" });
        return;
      }
      if (result === "has_content") {
        res.status(409).json({
          error:
            "Ce membre a des messages ou documents : suppression impossible en l'état",
        });
        return;
      }
      res.status(204).end();
    } catch (error) {
      console.error("Remove org member error:", error);
      res.status(500).json({ error: "Erreur lors du retrait du membre" });
    }
  },
);

export default router;
