# Déploiement — Lime

> Infrastructure de production : **Render** (héberge le frontend, le backend et Redis)
> et **Neon** (base PostgreSQL managée, externe à Render).
> Source de vérité : [`render.yaml`](../render.yaml) et les `Dockerfile` de chaque service.

## Environnements en ligne

| Service   | URL                                          | Hébergeur           |
| --------- | -------------------------------------------- | ------------------- |
| Frontend  | https://lime-frontend.onrender.com           | Render (Docker)     |
| Backend   | https://lime-backend-00k1.onrender.com       | Render (Docker)     |
| API docs  | https://lime-backend-00k1.onrender.com/api/docs | Render (Swagger UI) |
| Redis     | `lime-redis` (interne, pas d'accès public)   | Render (Key Value)  |
| PostgreSQL| connection string Neon (`DATABASE_URL`)      | **Neon** (externe)  |

Tous les services Render sont en région **Frankfurt** (hébergement UE) sur le plan
**free**, avec **HTTPS/TLS automatique**.

## Vue d'ensemble

```
                 ┌─────────────────────────── Render (Frankfurt) ───────────────────────────┐
Navigateur ──►   │  lime-frontend (Next.js)  ──HTTP/WS──►  lime-backend (Bun/Express)        │
                 │                                              │            │                │
                 │                                              │            └──►  lime-redis  │
                 └──────────────────────────────────────────────┼───────────────(pub/sub)────┘
                                                                 │
                                                                 ▼  TLS (sslmode=require)
                                                        Neon — PostgreSQL (externe)
```

- Le **frontend** appelle le backend via `NEXT_PUBLIC_API_URL` (HTTP + WebSocket).
- Le **backend** persiste dans PostgreSQL (**Neon**) et relaie les messages temps réel
  via **Redis** (pub/sub).
- Front et back sont sur des **domaines distincts** → le JWT ne peut pas voyager en cookie
  intersite : il est envoyé en header `Authorization: Bearer` (cf. `lib/http.ts`), et le
  backend autorise l'origine du front via `CLIENT_ORIGIN` (CORS).

## Déploiement (blueprint Render)

Le dépôt contient un **Blueprint** [`render.yaml`](../render.yaml) qui décrit les 3
ressources. Mise en place : *Render Dashboard → New → Blueprint → pointer ce dépôt*.

- **Déploiements automatiques** : déclenchés à chaque push (intégration GitHub).
- **Build Docker natif** : chaque service a son `Dockerfile` (`rootDir` = `chat-backend`
  ou `chat-client`).
- Les **migrations SQL s'appliquent au démarrage** du conteneur backend
  (`CMD: bun run migrate:deploy && bun run src/index.ts`).

### Backend — `chat-backend/Dockerfile`

Image Bun. HTTP **et** WebSocket sur le **même port** (`express-ws`), exposé sur `3001`.
Migrations jouées avant le démarrage.

### Frontend — `chat-client/Dockerfile`

Build Next.js multi-étapes. ⚠️ `NEXT_PUBLIC_API_URL` est **inlinée dans le bundle au
BUILD** (passée en build arg par Render) : après avoir changé l'URL du backend, il faut
**redéployer** le front pour reconstruire le bundle. `next start` écoute `$PORT` (défaut
3000).

## Variables d'environnement

### Backend (`lime-backend`)

| Variable            | Source                        | Rôle                                            |
| ------------------- | ----------------------------- | ----------------------------------------------- |
| `DATABASE_URL`      | **manuel** (Neon)             | Connection string Neon (pooler, `sslmode=require`). **Requise en prod** — le backend refuse de démarrer sans. |
| `DB_SSL`            | `"true"`                      | Active le TLS **avec** vérification du certificat (CA Neon publique). |
| `REDIS_URL`         | service `lime-redis`          | Connexion Redis (injectée par Render).          |
| `CHAT_PORT`         | `"3001"`                      | Port HTTP/WS.                                   |
| `JWT_SECRET`        | généré par Render             | Secret de signature des JWT.                    |
| `CLIENT_ORIGIN`     | **manuel**                    | URL HTTPS du frontend (CORS). Coller après le 1er déploiement du front. |
| `MAILTRAP_API_TOKEN`| **manuel** (secret)           | Envoi des emails d'invitation (Mailtrap).       |
| `MAILTRAP_INBOX_ID` | **manuel**                    | Défini ⇒ mode sandbox ; vide ⇒ envoi réel.      |
| `MAIL_FROM` / `MAIL_FROM_NAME` | valeurs par défaut | Expéditeur des invitations.                     |

> Sans `MAILTRAP_API_TOKEN`, les emails ne sont pas envoyés (seulement loggés) — utile en dev.

### Frontend (`lime-frontend`)

| Variable              | Source     | Rôle                                                          |
| --------------------- | ---------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | **manuel** | URL HTTPS du backend, **inlinée au build**. Redéployer après changement. |

## Base de données — Neon

PostgreSQL est **externe à Render**, hébergé sur **Neon** (Postgres serverless managé) :

- La `DATABASE_URL` (idéalement la connection string du **pooler** `-pooler`, avec
  `sslmode=require`) est collée **à la main** dans le dashboard Render du backend
  (`sync: false` dans `render.yaml`).
- Neon **exige TLS** : d'où `DB_SSL=true`, qui active le chiffrement avec vérification du
  certificat (la CA de Neon est publique, présente dans le store système — aucune CA custom
  à fournir, cf. `chat-backend/src/database.ts`).
- Le schéma est géré par **migrations** (`chat-backend/migrations/`), appliquées
  automatiquement au démarrage du conteneur backend. Voir
  [database/database.md](database/database.md).

## Dev local

En local, pas de Neon ni de Render : PostgreSQL et Redis tournent via **Docker Compose**
(cf. [stack.md](stack.md)). Le backend retombe sur des variables discrètes
(`DB_HOST`/`DB_PORT`/…) si `DATABASE_URL` n'est pas défini — ce fallback n'est destiné
**qu'au dev local**. Copier les `.env.example` pour démarrer.
