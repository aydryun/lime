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

// PUT /api/users/me — update current user profile
router.put("/me", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const { firstname, lastname, email, username } = req.body ?? {};

  if (!firstname || !lastname || !email || !username) {
    res.status(400).json({ error: "Tous les champs sont requis" });
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
      const field = error.constraint?.includes("email") ? "email" : "username";
      res.status(409).json({ error: `Ce ${field} est déjà utilisé` });
      return;
    }
    console.error("Update user error:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

// PUT /api/users/me/password — change current user password
router.put("/me/password", authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const { currentPassword, newPassword } = req.body ?? {};

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Mot de passe actuel et nouveau requis" });
    return;
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
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
    await updateUserPassword(userId, newHash);

    res.json({ message: "Mot de passe mis à jour" });
  } catch (error) {
    console.error("Change password error:", error);
    res
      .status(500)
      .json({ error: "Erreur lors du changement de mot de passe" });
  }
});

export default router;
