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
import { connectRedis, subscribeToMessages } from "./redis.js";
import swaggerDocument from "./swagger.js";
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

// Connected WebSocket clients, each tagged with its tenant (org) and user id.
const wsClients = new Map<
  WebSocket.WebSocket,
  { orgId: number; userId: number }
>();

/** Extracts the JWT from the ws upgrade request (HttpOnly cookie or Bearer header). */
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

// Initialize
async function start() {
  try {
    // Connect to Redis
    await connectRedis();

    // Subscribe to Redis messages and relay them only to clients that are
    // members of the message's channel (and thus its org).
    subscribeToMessages((message: unknown) => {
      void relayMessage(message);
    });

    // API docs
    app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

    // Auth routes
    app.use("/api/auth", authRouter);

    // User profile routes
    app.use("/api/users", usersRouter);

    // Channel + per-channel message routes
    app.use("/api/channels", channelsRouter);

    // WebSocket endpoint — authenticated relay, scoped to the client's org.
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

    // Relay a message only to connected clients that are members of its channel
    // (tenant isolation + pas de fuite inter-canaux au sein d'une même org).
    async function relayMessage(message: unknown) {
      const msg = message as { org_id?: number; channel_id?: number };
      if (typeof msg.org_id !== "number" || typeof msg.channel_id !== "number") {
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
            ws.readyState === 1 // OPEN
          ) {
            ws.send(data);
          }
        });
      } catch (err) {
        console.error("WS relay failed:", err);
      }
    }

    const PORT = process.env.CHAT_PORT || 3001;
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
