import express from "express";
import expressWs from "express-ws";
import cors from "cors";
import dotenv from "dotenv";
import {
  initializeDatabase,
  getAllMessages,
  insertMessage,
} from "./database.js";
import { connectRedis, publishMessage, subscribeToMessages } from "./redis.js";

dotenv.config();

const app = express();

// biome-ignore lint/suspicious/noExplicitAny : ws
const appWithWs = expressWs(app as any).app;

// Middleware
app.use(cors());
app.use(express.json());

// Store WebSocket clients
// biome-ignore lint/suspicious/noExplicitAny : ws
const wsClients = new Set<any>();

// Initialize
async function start() {
  try {
    // Initialize database
    await initializeDatabase();

    // Connect to Redis
    await connectRedis();

    // Subscribe to Redis messages and broadcast to WebSocket clients
    // biome-ignore lint/suspicious/noExplicitAny : message
    subscribeToMessages((message: any) => {
      broadcastToWebSocket({ type: "new_message", data: message });
    });

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
        const { sender, text } = req.body;

        if (!sender || !text) {
          res.status(400).json({ error: "sender and text are required" });
          return;
        }

        // Insert into PostgreSQL
        const message = await insertMessage(sender, text);

        // Publish to Redis
        await publishMessage("messages", message);

        res.json(message);
      } catch (error) {
        console.error("Error posting message:", error);
        res.status(500).json({ error: "Failed to post message" });
      }
    });

    // WebSocket endpoint
    // biome-ignore lint/suspicious/noExplicitAny : message
    (appWithWs as any).ws("/ws", (ws: any, _req: any) => {
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
        .catch((err) => console.error("Error sending initial messages:", err));

      // biome-ignore lint/suspicious/noExplicitAny : message
      ws.on("message", async (data: any) => {
        try {
          const msg = JSON.parse(data);

          if (msg.type === "send_message") {
            const { sender, text } = msg.data;

            if (!sender || !text) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  data: "sender and text are required",
                }),
              );
              return;
            }

            // Insert into PostgreSQL
            const message = await insertMessage(sender, text);

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

      // biome-ignore lint/suspicious/noExplicitAny : ws
      ws.on("error", (error: any) => {
        console.error("WebSocket error:", error);
        wsClients.delete(ws);
      });
    });

    // Helper function to broadcast to all WebSocket clients
    // biome-ignore lint/suspicious/noExplicitAny : message
    function broadcastToWebSocket(message: any) {
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
