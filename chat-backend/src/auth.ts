import bcrypt from "bcryptjs";
import { type Response, Router } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./config.js";
import {
  activateUser,
  createUserWithOrganisation,
  findUserByEmail,
} from "./database.js";

const router = Router();
const JWT_EXPIRES_IN = "24h";
const ACTIVATION_EXPIRES_IN = "7d";
const MIN_PASSWORD_LENGTH = 8;

/** Signs a short-lived token used in the invitation email to set the password. */
export function createActivationToken(userId: number): string {
  return jwt.sign({ userId, purpose: "activation" }, JWT_SECRET, {
    expiresIn: ACTIVATION_EXPIRES_IN,
  });
}

/** Name of the HttpOnly cookie holding the JWT session token. */
export const TOKEN_COOKIE = "chat_token";
const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Sets the auth JWT as an HttpOnly cookie on the response. */
function setAuthCookie(res: Response, token: string): void {
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: TOKEN_MAX_AGE_MS,
    path: "/",
  });
}

/** Removes the auth cookie from the client. */
function clearAuthCookie(res: Response): void {
  res.clearCookie(TOKEN_COOKIE, { path: "/" });
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { firstname, lastname, email, username, password, organisation } =
      req.body;

    if (!firstname || !lastname || !email || !username || !password) {
      res.status(400).json({ error: "Tous les champs sont requis" });
      return;
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: "Cet email est déjà utilisé" });
      return;
    }

    // Un nouveau compte crée sa propre organisation et en devient owner.
    const organisationName =
      typeof organisation === "string" && organisation.trim()
        ? organisation.trim()
        : `Organisation de ${firstname}`;

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await createUserWithOrganisation(
      firstname,
      lastname,
      email,
      username,
      hashedPassword,
      organisationName,
    );

    res.status(201).json(user);
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Erreur lors de l'inscription" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email et mot de passe requis" });
      return;
    }

    const user = await findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: "Identifiants invalides" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: "Identifiants invalides" });
      return;
    }

    // Un membre invité doit d'abord activer son compte via l'email reçu.
    if (user.activated_at === null) {
      res.status(403).json({
        error: "Compte non activé : consultez l'email d'invitation reçu",
      });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, orgId: user.org_id },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    setAuthCookie(res, token);

    res.json({
      token,
      user: {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        username: user.username,
        org_id: user.org_id,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Erreur lors de la connexion" });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  const cookieToken = req.cookies?.[TOKEN_COOKIE];
  const authHeader = req.headers.authorization;
  const headerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  const token = cookieToken ?? headerToken;

  if (!token) {
    res.status(401).json({ error: "Token manquant" });
    return;
  }

  try {
    jwt.verify(token, JWT_SECRET);
    clearAuthCookie(res);
    res.json({ message: "Déconnexion réussie" });
  } catch {
    res.status(401).json({ error: "Token invalide" });
  }
});

// POST /api/auth/activate — un membre invité définit son mot de passe via le token reçu par email
router.post("/activate", async (req, res) => {
  const { token, password } = req.body;

  if (typeof token !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Token et mot de passe requis" });
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({
      error: `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères`,
    });
    return;
  }

  let userId: number;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId?: unknown;
      purpose?: unknown;
    };
    if (
      payload.purpose !== "activation" ||
      typeof payload.userId !== "number"
    ) {
      res.status(401).json({ error: "Token invalide" });
      return;
    }
    userId = payload.userId;
  } catch {
    res.status(401).json({ error: "Token invalide ou expiré" });
    return;
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const activated = await activateUser(userId, hashedPassword);
    if (!activated) {
      res.status(404).json({ error: "Compte introuvable" });
      return;
    }
    res.json({ message: "Compte activé" });
  } catch (error) {
    console.error("Activate error:", error);
    res.status(500).json({ error: "Erreur lors de l'activation" });
  }
});

export default router;
