import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./routes/auth";
import { users } from "./routes/users";
import { teams } from "./routes/teams";
import { canaux } from "./routes/canaux";
import { messages } from "./routes/messages";
import { documents } from "./routes/documents";
import { roles } from "./routes/roles";

const app = new Hono().basePath("/api");

app.use("*", logger());
app.use("*", cors());

app.route("/auth", auth);
app.route("/users", users);
app.route("/teams", teams);
app.route("/canaux", canaux);
app.route("/messages", messages);
app.route("/documents", documents);
app.route("/roles", roles);

app.get("/", (c) => c.json({ message: "Lime API v0.1.0" }));

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};

console.log(`🍋 Lime server running on http://localhost:${port}`);
