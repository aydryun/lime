import bcrypt from "bcryptjs";
import { type Response, Router } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./config.js";
import { createUserWithOrganisation, findUserByEmail } from "./database.js";

const router = Router();
const JWT_EXPIRES_IN = "24h";

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

export default router;
