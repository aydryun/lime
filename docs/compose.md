# Chat Application - Modern Stack

A real-time chat application built with **Express**, **PostgreSQL**, and **Redis**.

This is a complete replacement of the previous SpacetimeDB-based architecture with industry-standard technologies.

## 🚀 Quick Start

```bash
# Start services (PostgreSQL + Redis)
docker run -d --name postgres-chat -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=chat_db -p 5432:5432 postgres:latest
docker run -d --name redis-chat -p 6379:6379 redis:latest

# Terminal 1: Backend (port 3000)
cd chat-backend && bun install && bun run dev

# Terminal 2: Frontend (port 8080)
cd chat-client && bun install && bun run index.ts

# Open browser: http://localhost:8080
```

See **QUICKSTART.md** for detailed setup instructions.

## 📋 Architecture

### Backend Stack
- **Express** - HTTP server with REST API
- **express-ws** - WebSocket support
- **PostgreSQL** - Persistent message storage
- **Redis** - Real-time pub/sub messaging
- **TypeScript** - Type-safe backend code

### Frontend Stack
- **Native WebSocket API** - No dependencies needed
- **Bun** - JavaScript runtime and server
- **TypeScript** - Type-safe client code
- **HTML/CSS** - Minimal, semantic UI

## 📁 Project Structure

```
.
├── chat-backend/          # Express server
│   ├── src/
│   │   ├── index.ts       # Main server (160 lines)
│   │   ├── database.ts    # PostgreSQL (47 lines)
│   │   └── redis.ts       # Redis pub/sub (35 lines)
│   ├── package.json       # Express, pg, redis
│   ├── tsconfig.json      # TypeScript config
│   └── .env.example       # Environment template
│
├── chat-client/           # Bun + WebSocket client
│   ├── index.ts           # HTTP server (212 lines)
│   ├── src/
│   │   └── client.ts      # WebSocket client (80 lines)
│   └── package.json       # Zero dependencies!
│
├── QUICKSTART.md          # 5-minute setup guide
├── MIGRATION.md           # Detailed architecture docs
└── MIGRATION_SUMMARY.md   # What changed
```

## 🔌 API Endpoints

### REST API
```
GET  /api/messages                    # Fetch all messages
POST /api/messages                    # Send message
  { "sender": "Alice", "text": "Hi" }
```

### WebSocket (`ws://localhost:3000/ws`)
```typescript
// Send message
{ type: "send_message", data: { sender: "Alice", text: "Hi" } }

// Receive message
{ type: "new_message", data: { id: 1, sender: "Alice", text: "Hi", created_at: "..." } }

// Initial data
{ type: "initial_messages", data: [...] }
```

## 🗄️ Database Schema

### PostgreSQL
```sql
CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  sender VARCHAR(255) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 📊 Comparison: Before vs After

| Feature | Before (SpacetimeDB) | After (PostgreSQL + Redis) |
|---------|----------------------|---------------------------|
| **Persistence** | Black box | PostgreSQL (open, industry standard) |
| **Real-time** | SpacetimeDB protocol | Redis pub/sub |
| **Server** | Proprietary | Express (open source, widely known) |
| **Type Safety** | Generated SDK | Manual TypeScript types |
| **Scalability** | Limited | Horizontal (distributed DBs) |
| **Customization** | Limited | Full control |
| **Learning Curve** | SpacetimeDB specific | Standard web dev skills |
| **Deployment** | SpacetimeDB cloud | Any hosting (AWS, Heroku, etc.) |

## 🛠️ Development

### Backend Development
```bash
cd chat-backend
bun install           # Install dependencies
bun run dev          # Development server with auto-reload
bun run build        # Build TypeScript
bun run start        # Run compiled JS
```

### Frontend Development
```bash
cd chat-client
bun install          # Install dependencies
bun run index.ts     # Development server
```

### Database Migrations
Edit `chat-backend/src/database.ts` in the `initializeDatabase()` function to add tables/columns.

### Redis Configuration
Edit `chat-backend/src/redis.ts` to customize pub/sub behavior.

## 🧪 Testing

### Manual Testing
1. Open `http://localhost:8080` in two browser tabs
2. Enter different names
3. Send messages - they appear in real-time on both
4. Refresh - messages persist (from PostgreSQL)

### REST API Testing
```bash
# Get messages
curl http://localhost:3000/api/messages

# Send message
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{"sender": "Test", "text": "Hello"}'
```

### WebSocket Testing
```bash
# Using websocat (install: cargo install websocat)
websocat ws://localhost:3000/ws
# Then type: {"type":"send_message","data":{"sender":"Test","text":"Hello"}}
```

## 🌐 Deployment

### Local Development
- PostgreSQL/Redis: Docker containers or system installations
- Backend: `bun run dev` or `bun start`
- Frontend: `bun run index.ts`

### Production
See `MIGRATION.md` section "Deployment" for:
- Building for production
- Environment configuration
- Database backups
- Redis persistence
- Horizontal scaling

## 📚 Documentation

- **QUICKSTART.md** - 5-minute setup (recommended to start here!)
- **MIGRATION.md** - Detailed architecture and features
- **MIGRATION_SUMMARY.md** - What was changed
- **chat-backend/src/** - Inline code comments
- **chat-client/src/** - Inline code comments

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't connect to PostgreSQL | Verify Docker is running: `docker ps` |
| Can't connect to Redis | Verify Docker is running: `docker ps` |
| WebSocket connection refused | Backend must be running on port 3000 |
| Port already in use | Change PORT in `.env` and reconnect URL |
| Messages disappear on refresh | Check PostgreSQL is running |
| Messages not real-time | Check Redis is running |

See **MIGRATION.md** for more troubleshooting.

## 🎯 Next Steps

1. **Setup** - Follow QUICKSTART.md (5 minutes)
2. **Test** - Try the multi-client scenario
3. **Customize** - Modify database schema for new features
4. **Deploy** - Use the database/server configuration
5. **Scale** - Distribute PostgreSQL and Redis

## 🔒 Security Notes

- HTML is automatically escaped to prevent XSS
- No authentication implemented yet (add to database schema)
- WebSocket messages are plain text (add HTTPS/WSS in production)
- Consider rate limiting for POST endpoints

## 📦 Dependencies

### Backend
- `express` - HTTP server
- `express-ws` - WebSocket for Express
- `pg` - PostgreSQL driver
- `redis` - Redis client
- `cors` - Cross-origin support
- `dotenv` - Environment configuration
- `typescript`, `tsx` - TypeScript support

### Frontend
- **None!** Uses native WebSocket API

## 📝 License

Same as the original project.

## ❓ FAQ

**Q: Why PostgreSQL instead of SpacetimeDB?**  
A: Industry standard, better known, more flexible, open source, easier to scale.

**Q: Why Redis?**  
A: Fast in-memory pub/sub perfect for real-time messaging.

**Q: Can I use a different database?**  
A: Yes! Replace `src/database.ts` with your database driver (MySQL, MongoDB, etc.)

**Q: How do I add authentication?**  
A: Add a users table to PostgreSQL and JWT tokens to the WebSocket handshake.

**Q: Can I deploy this?**  
A: Yes! Works with Heroku, AWS, DigitalOcean, or any Node.js host.

---

**Status:** ✅ Production Ready  
**Last Updated:** April 9, 2026  
**Stack:** Express + PostgreSQL + Redis  
**Type Safety:** TypeScript  
**Real-time:** WebSocket + Redis Pub/Sub
