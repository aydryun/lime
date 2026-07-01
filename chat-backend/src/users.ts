import bcrypt from "bcryptjs";
import { Router } from "express";
import {
  findUserById,
  getUserPasswordById,
  updateUser,
  updateUserPassword,
} from "./database.js";
import { type AuthRequest, authenticate } from "./middleware.js";

const router = Router();

type PgUniqueViolation = { code?: string; constraint?: string };

function isUniqueViolation(error: unknown): error is PgUniqueViolation {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as PgUniqueViolation).code === "23505"
  );
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// PUT /api/users/me — met à jour le profil de l'utilisateur connecté
router.put("/me", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const firstname = cleanString(req.body?.firstname);
  const lastname = cleanString(req.body?.lastname);
  const email = cleanString(req.body?.email);
  const username = cleanString(req.body?.username);

  if (!firstname || !lastname || !email || !username) {
    res.status(400).json({
      error: "Tous les champs sont requis et doivent être des chaînes valides",
    });
    return;
  }

  try {
    const updated = await updateUser(
      userId,
      firstname,
      lastname,
      email,
      username,
    );
    if (!updated) {
      res.status(404).json({ error: "Utilisateur introuvable" });
      return;
    }
    res.json(updated);
  } catch (error) {
    if (isUniqueViolation(error)) {
      const constraint = error.constraint ?? "";
      if (constraint.includes("email")) {
        res.status(409).json({ error: "Cet email est déjà utilisé" });
        return;
      }
      if (constraint.includes("username")) {
        res
          .status(409)
          .json({ error: "Ce nom d'utilisateur est déjà utilisé" });
        return;
      }
      res
        .status(409)
        .json({ error: "Email ou nom d'utilisateur déjà utilisé" });
      return;
    }
    console.error("Update user error:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

// PUT /api/users/me/password — change le mot de passe de l'utilisateur connecté
router.put("/me/password", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const { currentPassword, newPassword } = req.body ?? {};

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    res.status(400).json({ error: "Mot de passe actuel et nouveau requis" });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({
      error: "Le nouveau mot de passe doit faire au moins 8 caractères",
    });
    return;
  }

  try {
    const user = await findUserById(userId);
    if (!user) {
      res.status(404).json({ error: "Utilisateur introuvable" });
      return;
    }

    const hash = await getUserPasswordById(userId);
    if (!hash) {
      res.status(404).json({ error: "Utilisateur introuvable" });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, hash);
    if (!valid) {
      res.status(401).json({ error: "Mot de passe actuel invalide" });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    const updated = await updateUserPassword(userId, newHash);
    if (!updated) {
      res.status(404).json({ error: "Utilisateur introuvable" });
      return;
    }

    res.json({ message: "Mot de passe mis à jour" });
  } catch (error) {
    console.error("Change password error:", error);
    res
      .status(500)
      .json({ error: "Erreur lors du changement de mot de passe" });
  }
});

export default router;
