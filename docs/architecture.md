# Architecture

## Vue d'ensemble

Lime est une application de chat en temps réel construite avec une architecture client/serveur classique. Le backend expose une API REST et un endpoint WebSocket, tandis que le frontend est une application Next.js.

```
┌──────────────┐       HTTP / WS        ┌──────────────────┐
│  chat-client │ ◄────────────────────► │   chat-backend   │
│  (Next.js)   │                        │   (Express + WS) │
└──────────────┘                        └────────┬─────────┘
                                                 │
                                    ┌────────────┼────────────┐
                                    ▼                         ▼
                             ┌─────────────┐          ┌─────────────┐
                             │  PostgreSQL  │          │    Redis     │
                             │ (persistance)│          │  (pub/sub)  │
                             └─────────────┘          └─────────────┘
```

## Stack technique

### Backend (`chat-backend/`)

| Technologie | Rôle |
|---|---|
| **Bun** | Runtime TypeScript |
| **Express** | Serveur HTTP / routage REST |
| **express-ws** | Support WebSocket |
| **PostgreSQL** | Persistance des données |
| **Redis** | Pub/Sub temps réel entre instances |
| **JWT + bcrypt** | Authentification |
| **Swagger** | Documentation API |
| **Biome** | Linter / formatter |
| **node-pg-migrate** | Migrations SQL |

### Frontend (`chat-client/`)

| Technologie | Rôle |
|---|---|
| **Next.js 16** | Framework React (App Router) |
| **React 19** | UI |
| **Tailwind CSS 4** | Styles |
| **Radix UI + shadcn/ui** | Composants |
| **next-themes** | Thème clair/sombre |
| **Biome** | Linter / formatter |

## Structure du projet

```
lime/
├── chat-backend/
│   ├── src/
│   │   ├── index.ts          # Point d'entrée Express + WebSocket
│   │   ├── database.ts       # Requêtes PostgreSQL (Pool pg)
│   │   ├── redis.ts          # Client Redis pub/sub
│   │   ├── auth.ts           # Routes auth (register, login, logout)
│   │   ├── middleware.ts      # Middlewares Express
│   │   └── swagger.ts        # Définition OpenAPI
│   ├── migrations/            # Migrations SQL (node-pg-migrate)
│   └── package.json
│
├── chat-client/
│   ├── app/
│   │   ├── layout.tsx         # Layout racine (thème, fonts)
│   │   ├── page.tsx           # Page principale
│   │   └── globals.css        # Styles Tailwind
│   ├── components/            # Composants React (shadcn/ui)
│   └── package.json
│
├── compose.yml                # Docker Compose (PostgreSQL, Redis, Adminer)
├── .env                       # Variables d'environnement
└── package.json               # Scripts racine (dev, migrate, seed, lint)
```

## Base de données

Les migrations SQL se trouvent dans `chat-backend/migrations/`. Le schéma complet :

### Tables principales

- **users** — Utilisateurs (firstname, lastname, email, username, password)
- **messages** — Messages dans un channel (content, is_updated, is_pinned)
- **channels** — Canaux de discussion
- **teams** — Équipes
- **documents** — Fichiers attachés aux messages (type, file_path, file_name, file_size)

### Tables de liaison

- **team_users** — Membres d'une équipe
- **channel_team_users** — Accès aux channels (par team ou par user, avec contraintes d'unicité)
- **message_reaction_users** — Réactions sur les messages

### RBAC (Rôles & Permissions)

- **roles** — Rôles (is_admin, is_super_admin)
- **permissions** — Permissions avec action (GET, CREATE, UPDATE, DELETE)
- **role_permissions** — Association rôle ↔ permission
- **user_roles** — Attribution des rôles par scope (global, team, channel)

## Temps réel

Le flux temps réel fonctionne via Redis Pub/Sub :

1. Un client envoie un message via WebSocket ou POST REST
2. Le message est inséré en base PostgreSQL
3. Le message est publié sur le channel Redis `messages`
4. Tous les serveurs abonnés reçoivent le message via Redis
5. Chaque serveur broadcast aux clients WebSocket connectés

Ce mécanisme permet le scaling horizontal : plusieurs instances du backend peuvent tourner derrière un load balancer.

## Authentification

- **Register** `POST /api/auth/register` — Inscription (bcrypt hash du mot de passe)
- **Login** `POST /api/auth/login` — Connexion, retourne un JWT (expire en 24h)
- **Logout** `POST /api/auth/logout` — Déconnexion côté client

## Infrastructure locale

Docker Compose fournit les services :

| Service | Port | Description |
|---|---|---|
| PostgreSQL | 5432 | Base de données |
| Redis | 6379 | Pub/Sub temps réel |
| Adminer | 8081 | Interface web pour la DB |

## Historique des choix techniques

Les détails sur les technologies évaluées avant d'arriver à cette stack (SurrealDB, SpacetimeDB) sont documentés dans [architecture-legacy.md](architecture-legacy.md).
