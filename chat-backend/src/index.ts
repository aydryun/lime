import cors from "cors";
import dotenv from "dotenv";
import express, { type Request } from "express";
import expressWs, { type Application, type Instance } from "express-ws";
import swaggerUi from "swagger-ui-express";
import type * as WebSocket from "ws";
import authRouter from "./auth.js";
import { getAllMessages, insertMessage } from "./database.js";
import { connectRedis, publishMessage, subscribeToMessages } from "./redis.js";
import swaggerDocument from "./swagger.js";

dotenv.config();

const app = express();

const appWithWs = expressWs(app as unknown as Application).app;

// Middleware
app.use(cors());
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

    // REST API endpoints

    // Get all messages
    app.get("/api/messages", async (_req, res) => {
      try {
        const messages = await getAllMessages();
        res.json(messages);
      } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ error: "Failed to fetch messages" });
      }
    });

    // Post a new message (REST)
    app.post("/api/messages", async (req, res) => {
      try {
        const { senderId, text } = req.body;

        if (!senderId || !text) {
          res.status(400).json({ error: "senderId and text are required" });
          return;
        }

        // Insert into PostgreSQL
        const message = await insertMessage(senderId, text);

        // Publish to Redis
        await publishMessage("messages", message);

        res.json(message);
      } catch (error) {
        console.error("Error posting message:", error);
        res.status(500).json({ error: "Failed to post message" });
      }
    });

    // WebSocket endpoint
    (appWithWs as unknown as Instance["app"]).ws(
      "/ws",
      (ws: WebSocket.WebSocket, _req: Request) => {
        console.log("🟢 Client connected via WebSocket");
        wsClients.add(ws);

        // Send all existing messages on connect
        getAllMessages()
          .then((messages) => {
            ws.send(
              JSON.stringify({
                type: "initial_messages",
                data: messages,
              }),
            );
          })
          .catch((err) =>
            console.error("Error sending initial messages:", err),
          );

        ws.on("message", async (data: string) => {
          try {
            const msg = JSON.parse(data);

            if (msg.type === "send_message") {
              const { senderId, text } = msg.data;

              if (!senderId || !text) {
                ws.send(
                  JSON.stringify({
                    type: "error",
                    data: "senderId and text are required",
                  }),
                );
                return;
              }

              // Insert into PostgreSQL
              const message = await insertMessage(senderId, text);

              // Publish to Redis
              await publishMessage("messages", message);
            }
          } catch (error) {
            console.error("Error processing WebSocket message:", error);
            ws.send(
              JSON.stringify({
                type: "error",
                data: "Failed to process message",
              }),
            );
          }
        });

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
