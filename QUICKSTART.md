# Quick Start Guide

## Prerequisites

- Bun 1.0+ (JavaScript runtime - install from https://bun.sh)
- PostgreSQL 12+
- Redis 6+

## Setup in 5 Minutes

### 1. Start PostgreSQL and Redis (via Docker)

```bash
# PostgreSQL
docker run -d --name postgres-chat \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=chat_db \
  -p 5432:5432 \
  postgres:latest

# Redis
docker run -d --name redis-chat \
  -p 6379:6379 \
  redis:latest
```

### 2. Install Backend Dependencies

```bash
cd chat-backend
bun install
```

### 3. Configure Environment (Optional)

The defaults should work if you're running PostgreSQL and Redis locally:

```bash
# Check chat-backend/.env defaults - they're already set
cat chat-backend/.env.example
```

### 4. Start Backend Server

```bash
# From chat-backend/
bun run dev
```

Expected output:
```
✓ Database schema initialized
✓ Connected to Redis
🚀 Server running on http://localhost:3000
📡 WebSocket available at ws://localhost:3000/ws
```

### 5. Start Frontend (in new terminal)

```bash
cd chat-client
bun install
bun run index.ts
```

Expected output:
```
🌐 Ouvre ton navigateur sur http://localhost:8080
```

### 6. Open Browser

Visit `http://localhost:8080` in your browser

## Architecture at a Glance

```
┌─────────────────────────────────────────────────┐
│           Browser Client                        │
│  (JavaScript, WebSocket)                        │
└──────────────────┬──────────────────────────────┘
                   │
                   │ WebSocket
                   ↓
┌──────────────────────────────────────┐
│   Express Server (Port 3000)         │
│  - HTTP API (/api/messages)          │
│  - WebSocket Handler (/ws)           │
└───┬──────────────────────────┬───────┘
    │                          │
    │                          │
    ↓                          ↓
┌────────────────┐      ┌─────────────┐
│  PostgreSQL    │      │   Redis     │
│  (Persistent)  │      │ (Real-time) │
└────────────────┘      └─────────────┘
```

## Testing

### Test 1: Multiple Clients
1. Open `http://localhost:8080` in two browser windows
2. Enter different names (e.g., "Alice", "Bob")
3. Send messages from each window
4. Verify messages appear in real-time on both

### Test 2: Message Persistence
1. Send several messages
2. Refresh your browser
3. All messages should reappear (they're in PostgreSQL)

### Test 3: REST API
```bash
# Get all messages
curl http://localhost:3000/api/messages

# Send a message
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{"sender": "TestUser", "text": "Hello from curl!"}'
```

## Common Issues

| Problem | Solution |
|---------|----------|
| "Cannot connect to PostgreSQL" | Run PostgreSQL container or start system PostgreSQL |
| "Cannot connect to Redis" | Run Redis container or start system Redis |
| "Port 3000 already in use" | Change `PORT=3001` in `.env` and reconnect client to `ws://localhost:3001/ws` |
| "Port 8080 already in use" | Change `serve()` port in `chat-client/index.ts` |
| Messages not saving | Check PostgreSQL is running: `docker ps` |
| Messages not real-time | Check Redis is running: `redis-cli ping` |

## Next Steps

- Read `MIGRATION.md` for detailed architecture documentation
- Check `chat-backend/src/` for server implementation
- Modify `chat-client/src/client.ts` for client customization
- Add authentication, channels, or other features to `src/database.ts`

## Cleanup

To stop all services:

```bash
# Stop Bun servers
Ctrl+C (in both terminals)

# Stop Docker containers
docker stop postgres-chat redis-chat
docker rm postgres-chat redis-chat
```

## File Structure

```
.
├── chat-backend/
│   ├── src/
│   │   ├── index.ts       # Main server
│   │   ├── database.ts    # PostgreSQL
│   │   └── redis.ts       # Redis pub/sub
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example       # Environment template
├── chat-client/
│   ├── index.ts           # Bun server
│   ├── src/
│   │   └── client.ts      # WebSocket client
│   ├── package.json
│   └── tsconfig.json
├── MIGRATION.md           # Detailed migration guide
└── QUICKSTART.md          # This file
```

Happy chatting! 🎉
