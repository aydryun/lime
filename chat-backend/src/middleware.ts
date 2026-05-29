import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { TOKEN_COOKIE } from "./auth.js";

const JWT_SECRET = process.env.JWT_SECRET || "changeme";

/** Express request enriched with the authenticated user's id and org (populated by `authenticate`). */
export interface AuthRequest extends Request {
  userId?: number;
  orgId?: number;
}

/**
 * Express middleware that validates a JWT from the HttpOnly cookie or
 * Authorization header. Attaches `userId` to the request on success,
 * or responds 401 otherwise.
 */
export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const cookieToken = req.cookies?.[TOKEN_COOKIE];
  const header = req.headers.authorization;
  const headerToken = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const token = cookieToken ?? headerToken;

  if (!token) {
    res.status(401).json({ error: "Token manquant" });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: number;
      orgId: number;
    };
    req.userId = payload.userId;
    req.orgId = payload.orgId;
    next();
  } catch {
    res.status(401).json({ error: "Token invalide" });
  }
}
