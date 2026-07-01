# Schéma de base de données

## Vue d'ensemble

La base de données PostgreSQL est gérée via des migrations SQL (`chat-backend/migrations/`).

L'application est **multi-tenant** : `organisations` est la **frontière d'isolation**. Chaque `user`, `team`, `channel`, `message` et `document` appartient à exactement une organisation (`org_id NOT NULL`). Les données ne traversent jamais une organisation.

```
organisations ◄── org_id ── users / teams / channels / messages / documents
     ▲                                  (frontière tenant : org_id NOT NULL)
     │
users ──────┬──── team_users ──── teams
            │                       │
            ├──── user_roles ───── roles ──── role_permissions ──── permissions
            │         │
            │     (scope: org / team / channel — un seul à la fois)
            │
            ├──── messages ──────── channels
            │        │                 │
            │        ├── documents     │
            │        └── reactions     │
            │                          │
            └──── channel_team_users ──┘
                    (team ou user, dans l'org)
```

## Tables

### organisations

Tenant racine. Chaque ressource métier appartient à une organisation.

| Colonne | Type | Contraintes |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| nom | VARCHAR(255) | NOT NULL (nom d'affichage) |
| raison_sociale | VARCHAR(255) | nullable (nom légal) |
| siren | VARCHAR(9) | nullable, UNIQUE si renseigné (entité légale) |
| siret | VARCHAR(14) | nullable (établissement) |
| tva_intracommunautaire | VARCHAR(13) | nullable |
| email | VARCHAR(255) | nullable, UNIQUE si renseigné (contact) |
| telephone | VARCHAR(32) | nullable |
| adresse | VARCHAR(255) | nullable |
| code_postal | VARCHAR(16) | nullable |
| ville | VARCHAR(255) | nullable |
| pays | VARCHAR(255) | nullable |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() |

Le **propriétaire** d'une organisation n'est pas stocké ici : c'est l'utilisateur portant le rôle `org_owner` scopé sur l'org (table `user_roles`). Pas de FK circulaire org ↔ user.

### users

Utilisateurs de l'application. Un utilisateur appartient à **une seule** organisation.

| Colonne | Type | Contraintes |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| firstname | VARCHAR(255) | NOT NULL |
| lastname | VARCHAR(255) | NOT NULL |
| email | VARCHAR(255) | UNIQUE global, NOT NULL (login / cible d'invitation) |
| username | VARCHAR(255) | NOT NULL, UNIQUE **par org** (`(org_id, username)`) |
| password | VARCHAR(255) | NOT NULL (hash bcrypt) |
| org_id | INTEGER | FK → organisations(id), NOT NULL |
| activated_at | TIMESTAMP | DEFAULT NOW(), NULL tant que le membre invité n'a pas activé son compte |

Un membre invité est créé avec `activated_at = NULL` et un mot de passe aléatoire ; il l'active via le lien reçu par email (`POST /api/auth/activate`). Le login refuse un compte non activé.

### teams

Équipes regroupant des utilisateurs. **Hiérarchiques** : une équipe peut avoir une équipe parente (migration 021).

| Colonne | Type | Contraintes |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| name | VARCHAR(255) | NOT NULL |
| org_id | INTEGER | FK → organisations(id), NOT NULL |
| parent_team_id | INTEGER | nullable (NULL = équipe racine) |

**Contraintes (invariant tenant verrouillé en SQL) :**
- `UNIQUE (id, org_id)` (`teams_id_org_unique`) — préalable aux FK composites.
- FK **composite** `(parent_team_id, org_id) → teams(id, org_id)` (`teams_parent_same_org_fk`) : un parent doit exister **et** appartenir à la même org que l'enfant. Empêche toute cascade d'autorité RBAC inter-tenant. Pas d'`ON DELETE` : la suppression d'un parent réattache ses enfants au grand-parent en logique applicative (`deleteTeam`).
- Index `idx_teams_parent_team_id`.

`parent_team_id` est l'**unique** source de la hiérarchie (pas de colonne `level` → pas de redondance ni d'usurpation de niveau). La cascade d'autorité (un `team_owner`/`team_admin` gère ses sous-équipes) est calculée dynamiquement en remontant/descendant cette chaîne.

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
| org_id | INTEGER | FK → organisations(id), NOT NULL |
| is_org_wide | BOOLEAN | NOT NULL, DEFAULT FALSE (canal couvrant toute l'org — migration 022) |
| default_role_id | INTEGER | FK → roles(id), nullable (rôle par défaut des membres org-wide ; NULL ⇒ canal_member) |

`UNIQUE (id, org_id)` (`channels_id_org_unique`) — support des FK composites de `channel_team_users`.

### channel_team_users

Contrôle l'accès aux channels. Un lien rattache un channel à une **team** (tous ses membres y ont accès, éventuellement étendu au sous-arbre) ou à un **user** spécifique (accès individuel). Chaque lien porte le rôle attribué par défaut aux membres qui accèdent via lui.

| Colonne | Type | Contraintes |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| channel_id | INTEGER | FK → channels(id), NOT NULL |
| team_id | INTEGER | FK → teams(id), nullable |
| user_id | INTEGER | FK → users(id), nullable |
| include_descendants | BOOLEAN | NOT NULL, DEFAULT FALSE (lien team étendu au sous-arbre — migration 022) |
| default_role_id | INTEGER | FK → roles(id), nullable (rôle par défaut via ce lien ; NULL ⇒ canal_member) |
| org_id | INTEGER | NOT NULL (dénormalisé depuis le canal — migration 022) |

**Contraintes :**
- `CHECK (team_id IS NOT NULL OR user_id IS NOT NULL)` — au moins un des deux doit être renseigné
- Index unique sur `(channel_id, team_id)` quand team_id est non null
- Index unique sur `(channel_id, user_id)` quand user_id est non null
- FK **composites** garantissant l'isolation tenant (migration 022) : `(channel_id, org_id) → channels`, `(team_id, org_id) → teams`, `(user_id, org_id) → users`. Tout lien inter-org est rejeté au niveau SQL.

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
| org_id | INTEGER | FK → organisations(id), NOT NULL (dénormalisé depuis le canal) |

**Index :** channel_id, user_id, created_at DESC, org_id

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
| org_id | INTEGER | FK → organisations(id), NOT NULL (dénormalisé depuis le canal) |

**Index :** channel_id, user_id, message_id, org_id

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
| name | VARCHAR(255) | NOT NULL, UNIQUE (`roles_name_unique`) |
| is_admin | BOOLEAN | DEFAULT FALSE |
| is_super_admin | BOOLEAN | DEFAULT FALSE |

Rôles par défaut (seed) :
- Globaux : **admin**, **moderator**, **member**
- Organisation : **org_owner**, **org_admin** (scope `org_id`)
- Équipe : **team_owner**, **team_admin**, **team_member** (scope `team_id`)
- Canal : **canal_owner**, **canal_admin**, **canal_member**, **canal_reader** (lecture seule — migration 020) (scope `channel_id`)

### permissions

| Colonne | Type | Contraintes |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| category | VARCHAR(255) | — |
| action | permission_action | DEFAULT 'GET' |

Type enum `permission_action` : `GET`, `CREATE`, `UPDATE`, `DELETE`
Unicité `(category, action)` (`permissions_category_action_unique`, migration 019).

Catégories : `message`, `channel`, `team`, `org`, `member` (les deux dernières ajoutées en migration 019).

### role_permissions

Association rôle ↔ permission. **Effectivement appliqué** par le code via
`userHasPermission(userId, category, action, scope)` : un rôle org-scopé couvre
toute l'org, un rôle team/canal-scopé ne couvre que sa team / son canal.

| Colonne | Type | Contraintes |
|---|---|---|
| role_id | INTEGER | FK → roles(id), PK |
| permission_id | INTEGER | FK → permissions(id), PK |

Seed (migrations 019 → 022), au-delà des rôles génériques de démo :

| Rôle | Permissions |
|---|---|
| org_owner / org_admin | toutes catégories, toutes actions |
| member | team GET (voir ses équipes) |
| team_owner | team GET/UPDATE/DELETE/**CREATE**, channel **CREATE** |
| team_admin | team GET/UPDATE/**CREATE**, channel **CREATE** |
| team_member | team GET |
| canal_owner | channel GET/UPDATE/DELETE, message GET/CREATE/UPDATE/DELETE |
| canal_admin | channel GET/UPDATE, message GET/CREATE/UPDATE/DELETE |
| canal_member | channel GET, message GET/CREATE |
| canal_reader | channel GET, message GET (lecture seule) |

> `team:CREATE` / `channel:CREATE` accordés à team_owner/team_admin (migrations 021/022) autorisent la création de **sous-équipes** et de **canaux scopés** ; la portée exacte (sur quel parent / quelle équipe) est vérifiée par `userHasPermission`, qui remonte la chaîne `parent_team_id` (cascade d'autorité).

Rôles génériques de démo (seed applicatif) :

| Rôle | GET | CREATE | UPDATE | DELETE |
|---|---|---|---|---|
| admin | oui | oui | oui | oui |
| moderator | oui | oui | oui | non |
| member | oui | oui | non | non |

### user_roles

Attribution des rôles avec scope optionnel (**org**, team **ou** channel).

| Colonne | Type | Contraintes |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| user_id | INTEGER | FK → users(id), NOT NULL |
| role_id | INTEGER | FK → roles(id), NOT NULL |
| team_id | INTEGER | FK → teams(id), nullable |
| channel_id | INTEGER | FK → channels(id), nullable |
| org_id | INTEGER | FK → organisations(id), nullable |

**Contraintes :**
- `CHECK` — au plus un seul scope renseigné parmi `org_id`, `team_id`, `channel_id` (jamais deux à la fois).
- **Index unique** sur `(user_id, role_id, COALESCE(team_id, 0), COALESCE(channel_id, 0), COALESCE(org_id, 0))` — empêche les doublons par scope.

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
