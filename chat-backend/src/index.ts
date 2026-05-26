import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express, { type Request } from "express";
import expressWs, { type Application, type Instance } from "express-ws";
import swaggerUi from "swagger-ui-express";
import type * as WebSocket from "ws";
import authRouter from "./auth.js";
import channelsRouter from "./channels.js";
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

// Store WebSocket clients
const wsClients = new Set<WebSocket.WebSocket>();

// Initialize
async function start() {
  try {
    // Connect to Redis
    await connectRedis();

    // Subscribe to Redis messages and broadcast to WebSocket clients
    subscribeToMessages((message: unknown) => {
      broadcastToWebSocket({ type: "new_message", data: message });
    });

    // API docs
    app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

    // Auth routes
    app.use("/api/auth", authRouter);

    // User profile routes
    app.use("/api/users", usersRouter);

    // Channel + per-channel message routes
    app.use("/api/channels", channelsRouter);

    // WebSocket endpoint — broadcast-only relay for messages published to Redis.
    (appWithWs as unknown as Instance["app"]).ws(
      "/ws",
      (ws: WebSocket.WebSocket, _req: Request) => {
        console.log("🟢 Client connected via WebSocket");
        wsClients.add(ws);

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

    // Helper function to broadcast to all WebSocket clients
    function broadcastToWebSocket(message: unknown) {
      const data = JSON.stringify(message);
      wsClients.forEach((client) => {
        if (client.readyState === 1) {
          // OPEN
          client.send(data);
        }
      });
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
