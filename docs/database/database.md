# Schéma de base de données

## Vue d'ensemble

La base de données PostgreSQL est gérée via des migrations SQL (`chat-backend/migrations/`).

```
users ──────┬──── team_users ──── teams
            │                       │
            ├──── user_roles ───── roles ──── role_permissions ──── permissions
            │         │
            │     (scope: team/channel)
            │
            ├──── messages ──────── channels
            │        │                 │
            │        ├── documents     │
            │        └── reactions     │
            │                          │
            └──── channel_team_users ──┘
                    (team ou user)
```

## Tables

### users

Utilisateurs de l'application.

| Colonne | Type | Contraintes |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| firstname | VARCHAR(255) | NOT NULL |
| lastname | VARCHAR(255) | NOT NULL |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| username | VARCHAR(255) | UNIQUE, NOT NULL |
| password | VARCHAR(255) | NOT NULL (hash bcrypt) |

### teams

Équipes regroupant des utilisateurs.

| Colonne | Type | Contraintes |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| name | VARCHAR(255) | NOT NULL |

### team_users

Table de liaison équipe ↔ utilisateur.

| Colonne | Type | Contraintes |
|---|---|---|
| team_id | INTEGER | FK → teams(id), PK |
| user_id | INTEGER | FK → users(id), PK |

### channels

Canaux de discussion.

| Colonne | Type | Contraintes |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| name | VARCHAR(255) | NOT NULL |

### channel_team_users

Contrôle l'accès aux channels. Un channel peut être lié à une **team** (tous les membres y ont accès) ou à un **user** spécifique (DM ou accès individuel).

| Colonne | Type | Contraintes |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| channel_id | INTEGER | FK → channels(id), NOT NULL |
| team_id | INTEGER | FK → teams(id), nullable |
| user_id | INTEGER | FK → users(id), nullable |

**Contraintes :**
- `CHECK (team_id IS NOT NULL OR user_id IS NOT NULL)` — au moins un des deux doit être renseigné
- Index unique sur `(channel_id, team_id)` quand team_id est non null
- Index unique sur `(channel_id, user_id)` quand user_id est non null

### messages

Messages envoyés dans un channel.

| Colonne | Type | Contraintes |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| channel_id | INTEGER | FK → channels(id), NOT NULL |
| user_id | INTEGER | FK → users(id), NOT NULL |
| content | TEXT | nullable |
| is_updated | BOOLEAN | NOT NULL, DEFAULT FALSE |
| is_pinned | BOOLEAN | NOT NULL, DEFAULT FALSE |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**Index :** channel_id, user_id, created_at DESC

### documents

Fichiers attachés à un message.

| Colonne | Type | Contraintes |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| channel_id | INTEGER | FK → channels(id), NOT NULL |
| user_id | INTEGER | FK → users(id), NOT NULL |
| message_id | INTEGER | FK → messages(id), NOT NULL |
| type | VARCHAR(255) | NOT NULL |
| file_path | VARCHAR(512) | NOT NULL |
| file_name | VARCHAR(255) | NOT NULL |
| file_size | INTEGER | nullable |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**Index :** channel_id, user_id, message_id

### message_reaction_users

Réactions emoji sur les messages.

| Colonne | Type | Contraintes |
|---|---|---|
| message_id | INTEGER | FK → messages(id), PK |
| user_id | INTEGER | FK → users(id), PK |
| reaction | VARCHAR(255) | NOT NULL, PK |

Un utilisateur ne peut mettre qu'une seule fois la même réaction sur un message (clé primaire composite).

## RBAC — Rôles & Permissions

### roles

| Colonne | Type | Contraintes |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| name | VARCHAR(255) | NOT NULL |
| is_admin | BOOLEAN | DEFAULT FALSE |
| is_super_admin | BOOLEAN | DEFAULT FALSE |

Rôles par défaut (seed) : **admin**, **moderator**, **member**

### permissions

| Colonne | Type | Contraintes |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| category | VARCHAR(255) | — |
| action | permission_action | DEFAULT 'GET' |

Type enum `permission_action` : `GET`, `CREATE`, `UPDATE`, `DELETE`

Catégories existantes : `message`, `channel`, `team`

### role_permissions

Association rôle ↔ permission.

| Colonne | Type | Contraintes |
|---|---|---|
| role_id | INTEGER | FK → roles(id), PK |
| permission_id | INTEGER | FK → permissions(id), PK |

Permissions par rôle (seed) :

| Rôle | GET | CREATE | UPDATE | DELETE |
|---|---|---|---|---|
| admin | oui | oui | oui | oui |
| moderator | oui | oui | oui | non |
| member | oui | oui | non | non |

### user_roles

Attribution des rôles avec scope optionnel (team et/ou channel).

| Colonne | Type | Contraintes |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| user_id | INTEGER | FK → users(id), NOT NULL |
| role_id | INTEGER | FK → roles(id), NOT NULL |
| team_id | INTEGER | FK → teams(id), nullable |
| channel_id | INTEGER | FK → channels(id), nullable |

**Index unique** sur `(user_id, role_id, COALESCE(team_id, 0), COALESCE(channel_id, 0))` — empêche les doublons par scope.

## Commandes utiles

```bash
# Lancer les migrations
bun run migrate:up

# Rollback dernière migration
bun run migrate:down

# Créer une nouvelle migration
bun run migrate:create nom_de_la_migration

# Reset complet (drop + recreate + migrate + seed)
bun run db:reset

# Seed (données de test)
bun run seed
```
