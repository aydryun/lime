# syntax=docker/dockerfile:1

# --- Dépendances (couche mise en cache) ---
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# --- Image finale ---
FROM oven/bun:1
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# HTTP + WebSocket sur le même port (express-ws)
EXPOSE 3001

# Applique les migrations puis démarre le serveur.
CMD ["sh", "-c", "bun run migrate:deploy && bun run src/index.ts"]
