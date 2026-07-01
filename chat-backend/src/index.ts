import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express, { type Request } from "express";
import expressWs, { type Application, type Instance } from "express-ws";
import jwt from "jsonwebtoken";
import swaggerUi from "swagger-ui-express";
import type * as WebSocket from "ws";
import authRouter, { TOKEN_COOKIE } from "./auth.js";
import channelsRouter from "./channels.js";
import { JWT_SECRET } from "./config.js";
import { listChannelMembers } from "./database.js";
import organisationsRouter from "./organisations.js";
import { connectRedis, subscribeToMessages } from "./redis.js";
import swaggerDocument from "./swagger.js";
import teamsRouter from "./teams.js";
import usersRouter from "./users.js";

dotenv.config();

const app = express();

const appWithWs = expressWs(app as unknown as Application).app;

// Middleware
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());

// Clients WebSocket connectés, chacun étiqueté avec son tenant (org) et son id utilisateur.
const wsClients = new Map<
  WebSocket.WebSocket,
  { orgId: number; userId: number }
>();

/** Extrait le JWT de la requête d'upgrade ws (cookie HttpOnly ou header Bearer). */
function tokenFromRequest(req: Request): string | null {
  const cookieToken = (req as Request & { cookies?: Record<string, string> })
    .cookies?.[TOKEN_COOKIE];
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  // Fallback : parse manuel du header Cookie si cookie-parser n'a pas tourné.
  const raw = req.headers.cookie;
  if (raw) {
    for (const part of raw.split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (name === TOKEN_COOKIE) return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

// Initialisation
async function start() {
  try {
    // Connexion à Redis
    await connectRedis();

    // S'abonne aux messages Redis et ne les relaie qu'aux clients membres
    // du canal du message (et donc de son org).
    subscribeToMessages((message: unknown) => {
      void relayMessage(message);
    });

    // Docs API
    app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

    // Routes d'authentification
    app.use("/api/auth", authRouter);

    // Routes de profil utilisateur
    app.use("/api/users", usersRouter);

    // Routes des canaux + messages par canal
    app.use("/api/channels", channelsRouter);

    // Organisation (infos entreprise + membres)
    app.use("/api/org", organisationsRouter);

    // Teams (CRUD + membres)
    app.use("/api/teams", teamsRouter);

    // Endpoint WebSocket — relais authentifié, scopé à l'org du client.
    (appWithWs as unknown as Instance["app"]).ws(
      "/ws",
      (ws: WebSocket.WebSocket, req: Request) => {
        const token = tokenFromRequest(req);
        let userId: unknown;
        let orgId: unknown;
        try {
          const payload = jwt.verify(token ?? "", JWT_SECRET) as {
            userId?: unknown;
            orgId?: unknown;
          };
          userId = payload.userId;
          orgId = payload.orgId;
        } catch {
          ws.close(1008, "Unauthorized");
          return;
        }
        // Validation runtime : refuse un token sans userId/orgId valides.
        if (typeof userId !== "number" || typeof orgId !== "number") {
          ws.close(1008, "Unauthorized");
          return;
        }

        console.log(`🟢 Client connected via WebSocket (org ${orgId})`);
        wsClients.set(ws, { orgId, userId });

        ws.on("close", () => {
          console.log("🔴 Client disconnected");
          wsClients.delete(ws);
        });

        ws.on("error", (error: Error) => {
          console.error("WebSocket error:", error);
          wsClients.delete(ws);
        });
      },
    );

    // Ne relaie un message qu'aux clients connectés membres de son canal
    // (tenant isolation + pas de fuite inter-canaux au sein d'une même org).
    async function relayMessage(message: unknown) {
      const msg = message as { org_id?: number; channel_id?: number };
      if (
        typeof msg.org_id !== "number" ||
        typeof msg.channel_id !== "number"
      ) {
        return;
      }
      try {
        const members = await listChannelMembers(msg.channel_id);
        const memberIds = new Set<number>(members.map((m) => m.user_id));
        const data = JSON.stringify({ type: "new_message", data: message });
        wsClients.forEach((client, ws) => {
          if (
            client.orgId === msg.org_id &&
            memberIds.has(client.userId) &&
            ws.readyState === 1 // OUVERT
          ) {
            ws.send(data);
          }
        });
      } catch (err) {
        console.error("WS relay failed:", err);
      }
    }

    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📡 WebSocket available at ws://localhost:${PORT}/ws`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();
