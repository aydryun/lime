# API Routes — Lime

> API REST, préfixe `/api`. Source de vérité : `chat-backend/src/`.
> Documentation interactive (Swagger UI) : **`GET /api/docs`**.

## Conventions

- Toutes les routes hors `Auth` exigent une session authentifiée.
- L'authentification passe par un **JWT** transmis de deux façons (l'un ou l'autre) :
  - cookie `HttpOnly` `chat_token` (posé automatiquement au login) ;
  - header `Authorization: Bearer <token>`.
- Le token porte `{ userId, orgId }` et **expire après 24 h**. Un token sans `orgId`
  (antérieur au multi-tenant) est rejeté (`401`).
- **Multi-tenant** : chaque requête est implicitement scopée à l'organisation du token
  (`orgId`). Aucune donnée ne traverse une organisation.
- Les modifications utilisent **`PUT` / `PATCH`** (jamais `POST`), y compris le
  changement de mot de passe.
- Réponses d'erreur : `{ "error": "message" }`. Codes usuels : `400` (validation),
  `401` (non authentifié), `403` (permission refusée), `404` (introuvable),
  `409` (conflit), `500` (erreur serveur).

Les permissions listées (`team:UPDATE`, `member:CREATE`…) renvoient au modèle RBAC —
voir [fonctionnalites.md](fonctionnalites.md#rbac--rôles--permissions) et
[database/database.md](database/database.md#rbac--rôles--permissions).

---

## Auth — `/api/auth`

Routes publiques (aucun token requis, sauf `logout`).

| Méthode | Route       | Description                                   |
| ------- | ----------- | --------------------------------------------- |
| POST    | `/register` | Crée un compte **et son organisation**        |
| POST    | `/login`    | Connexion, retourne un token + pose le cookie |
| POST    | `/logout`   | Déconnexion (efface le cookie)                |
| POST    | `/activate` | Un membre invité définit son mot de passe     |

### `POST /api/auth/register`

Crée un utilisateur qui devient **`org_owner`** d'une nouvelle organisation. Le champ
`organisation` est optionnel (défaut : « Organisation de `<prénom>` »).

**Body :**
```json
{
  "firstname": "Lucas",
  "lastname": "Martin",
  "email": "lucas@lime.app",
  "username": "lucas",
  "password": "secret123",
  "organisation": "Milestone"
}
```

**`201`** → `{ id, firstname, lastname, email, username }`
**Erreurs :** `400` champs manquants · `409` email déjà utilisé

### `POST /api/auth/login`

**Body :** `{ "email": "lucas@lime.app", "password": "secret123" }`

**`200`** — pose le cookie `chat_token` et retourne :
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": 1, "firstname": "Lucas", "lastname": "Martin", "email": "lucas@lime.app", "username": "lucas", "org_id": 1 }
}
```
**Erreurs :** `400` champs manquants · `401` identifiants invalides · `403` compte non activé (membre invité n'ayant pas encore suivi le lien d'activation)

### `POST /api/auth/logout`

Nécessite un token (cookie ou Bearer). **`200`** → `{ "message": "Déconnexion réussie" }` · `401` token manquant/invalide.

### `POST /api/auth/activate`

Un membre invité définit son mot de passe via le token reçu par email (valable **7 jours**).

**Body :** `{ "token": "<token d'activation>", "password": "secret123" }` (mot de passe ≥ 8 caractères)
**`200`** → `{ "message": "Compte activé" }`
**Erreurs :** `400` mot de passe trop court · `401` token invalide/expiré · `404` compte introuvable

---

## Utilisateurs — `/api/users`

L'utilisateur n'agit que sur **son propre** compte (`/me`).

| Méthode | Route          | Description                                       |
| ------- | -------------- | ------------------------------------------------- |
| PUT     | `/me`          | Met à jour son profil                             |
| PUT     | `/me/password` | Change son mot de passe                           |

### `PUT /api/users/me`

**Body :** `{ "firstname", "lastname", "email", "username" }` (tous requis)
**`200`** → profil mis à jour · **Erreurs :** `400` · `409` email ou username déjà utilisé

### `PUT /api/users/me/password`

**Body :** `{ "currentPassword": "...", "newPassword": "..." }` (nouveau ≥ 8 caractères)
**`200`** → `{ "message": "Mot de passe mis à jour" }` · **Erreurs :** `400` · `401` mot de passe actuel invalide

---

## Organisation — `/api/org`

Gestion de l'entreprise et de ses membres. Le tenant est celui du token.

| Méthode | Route               | Permission     | Description                              |
| ------- | ------------------- | -------------- | ---------------------------------------- |
| GET     | `/`                 | authentifié    | Infos de l'organisation courante         |
| PATCH   | `/`                 | `org:UPDATE`   | Met à jour les infos entreprise          |
| GET     | `/members`          | authentifié    | Liste des membres (sélecteurs d'users)   |
| POST    | `/members`          | `member:CREATE`| Invite un membre (email d'activation)    |
| PATCH   | `/members/:userId`  | `member:UPDATE`| Change le rôle d'org d'un membre         |
| DELETE  | `/members/:userId`  | `member:DELETE`| Retire un membre de l'organisation       |

### `PATCH /api/org`

Champs modifiables : `nom` (obligatoire, non effaçable), `raison_sociale`, `siren` (9 chiffres),
`siret` (14 chiffres), `tva_intracommunautaire`, `email`, `telephone`, `adresse`, `code_postal`,
`ville`, `pays`. Envoyer `null`/`""` efface un champ (sauf `nom`).
**`200`** → org · **Erreurs :** `400` validation · `409` SIREN/email déjà pris par une autre org

### `POST /api/org/members`

Crée un membre `activated_at = NULL` et lui envoie un email d'invitation. Le membre définit son
mot de passe via `POST /api/auth/activate`.

**Body :** `{ "firstname", "lastname", "username", "email", "role"?: "org_admin" | "member" }`
**`201`** → `{ id, firstname, lastname, email, username, role, emailSent }`
(`emailSent: false` si l'email a échoué — le compte est créé quand même)
**Erreurs :** `400` · `409` email/username déjà utilisé

### `PATCH /api/org/members/:userId`

**Body :** `{ "role": "org_admin" | "member" }` · **`200`** → `{ id, role }` · **`403`** le rôle de l'`org_owner` est immuable

### `DELETE /api/org/members/:userId`

**`204`** · **Erreurs :** `400` on ne peut pas se retirer soi-même · `403` l'`org_owner` est protégé · `409` le membre a des messages/documents (suppression bloquée)

---

## Équipes — `/api/teams`

Équipes **hiérarchiques** (une équipe peut avoir une équipe parente). L'autorité cascade :
un manager d'une équipe gère automatiquement ses sous-équipes.

| Méthode | Route                     | Permission                    | Description                       |
| ------- | ------------------------- | ----------------------------- | --------------------------------- |
| GET     | `/`                       | authentifié                   | Ses équipes (ou toutes si manager d'org) |
| POST    | `/`                       | `team:CREATE` (scope parent)  | Crée une équipe (ou sous-équipe)  |
| GET     | `/:id`                    | membre / manager              | Détail + membres                  |
| PATCH   | `/:id`                    | `team:UPDATE`                 | Renomme                           |
| DELETE  | `/:id`                    | `team:DELETE`                 | Supprime                          |
| GET     | `/:id/members`            | membre / manager              | Liste des membres                 |
| POST    | `/:id/members`            | `team:UPDATE` (+ périmètre)   | Ajoute un membre                  |
| PATCH   | `/:id/members/:userId`    | `team:UPDATE`                 | Change le rôle d'un membre        |
| DELETE  | `/:id/members/:userId`    | `team:UPDATE` ou soi-même     | Retire un membre                  |

- **`GET /`** : un manager d'org (`org_owner`/`org_admin`) voit toutes les équipes ; un membre
  simple ne voit que celles dont il fait partie (ou qu'il gère par cascade).
- **`POST /`** : avec `parent_team_id`, crée une sous-équipe — la permission est vérifiée **au scope
  du parent** (un `team_owner`/`team_admin` du parent ou d'un ancêtre peut créer). Sans parent
  (équipe racine), seul un manager d'org passe. `parent_team_id` doit être dans la même org.
- **`POST /:id/members`** : body `{ "userId": 3, "role"?: "team_admin" | "team_member" }`. Hors
  manager d'org, l'appelant ne peut recruter que des utilisateurs déjà sous son autorité
  (périmètre du sous-arbre). Réponses : `201` · `400` pas dans l'org · `409` déjà membre.
- **`PATCH /:id/members/:userId`** : body `{ "role": "team_owner" | "team_admin" | "team_member" }`.
  Toucher à la **propriété** (promouvoir `team_owner` ou modifier le `team_owner` actuel) est
  réservé au manager d'org et au propriétaire courant.
- **`DELETE /:id/members/:userId`** : on peut toujours se retirer soi-même ; retirer autrui exige
  `team:UPDATE`.

---

## Canaux — `/api/channels`

Un canal a un **propriétaire** (`canal_owner`, son créateur) et des membres avec un rôle canal.
L'accès dérive de liens explicites, de liens d'équipe (éventuellement étendus au sous-arbre) ou
du statut « org-wide ».

| Méthode | Route                      | Autorisation                  | Description                        |
| ------- | -------------------------- | ----------------------------- | ---------------------------------- |
| GET     | `/`                        | authentifié                   | Canaux visibles + `my_role`        |
| POST    | `/`                        | selon `mode`                  | Crée un canal                      |
| PATCH   | `/:id`                     | `canal_owner`                 | Renomme                            |
| DELETE  | `/:id`                     | `canal_owner`                 | Supprime pour tous                 |
| GET     | `/:id/members`             | membre                        | Membres + rôles                    |
| GET     | `/:id/non-members?q=`      | owner / admin                 | Utilisateurs non membres (recherche) |
| POST    | `/:id/members`             | owner / admin                 | Ajoute un membre                   |
| PATCH   | `/:id/members/:userId`     | `canal_owner`                 | Change le rôle d'un membre         |
| POST    | `/:id/transfer`            | `canal_owner`                 | Transfère la propriété             |
| DELETE  | `/:id/members/:userId`     | owner / admin / soi-même      | Retire un membre / quitte          |
| GET     | `/:id/messages`            | membre                        | Messages du canal                  |
| POST    | `/:id/messages`            | membre (sauf `canal_reader`)  | Envoie un message                  |

### `POST /api/channels`

**Body :** `{ "name": "général", "mode"?: "...", "default_role"?: "...", "team_id"?: N, "user_ids"?: [N] }`

`mode` (défaut `private`) détermine le peuplement initial et l'autorisation requise :

| mode           | Peuplement                                   | Autorisation                                |
| -------------- | -------------------------------------------- | ------------------------------------------- |
| `private`      | le créateur seul                             | tout authentifié                            |
| `org`          | toute l'organisation                         | `channel:CREATE` au scope org (manager d'org) |
| `team`         | les membres directs d'une équipe             | gérer cette équipe (`channel:CREATE` cascade) |
| `team_subtree` | l'équipe **et tout son sous-arbre**          | idem `team`                                 |
| `members`      | des utilisateurs précis (`user_ids`)         | chaque cible sous l'autorité de l'appelant (`canManageUser`) |

- `default_role` (rôle attribué aux membres ajoutés via le lien) : `canal_admin`, `canal_member`
  (défaut) ou `canal_reader`.
- `team`/`team_subtree` exigent `team_id` (même org).
- `members` exige `user_ids` : liste d'entiers > 0, **dédupliquée** et **plafonnée à 500**.
- **`201`** → `{ ...channel, my_role: "canal_owner" }`.

### `POST /api/channels/:id/members`

**Body :** `{ "userId": 2 }` · **`201`** `{ "added": true }` (ou `200 { "added": false }` si déjà membre)

### `PATCH /api/channels/:id/members/:userId`

**Body :** `{ "role": "canal_admin" | "canal_member" | "canal_reader" }` · réservé au `canal_owner`.
`409` on ne change pas le rôle du propriétaire.

### `POST /api/channels/:id/transfer`

**Body :** `{ "userId": 2 }` (doit déjà être membre). Le `canal_owner` cède la propriété et
redevient membre. **`200`** → `{ "message": "Propriété transférée" }`.

### `DELETE /api/channels/:id/members/:userId`

- **Se retirer soi-même** : si l'appelant est `canal_owner` et qu'il reste d'autres membres →
  `409 { code: "OWNER_HAS_MEMBERS" }` (transférer ou supprimer d'abord). Propriétaire seul →
  quitter **supprime** le canal.
- **Retirer autrui** : owner retire n'importe qui ; `canal_admin` ne retire qu'un `canal_member`
  (pas un autre admin ni le propriétaire).

### `POST /api/channels/:id/messages`

**Body :** `{ "content": "Bonjour" }` (1–4000 caractères). Un `canal_reader` est en **lecture seule**
(`403`). **`201`** → message créé, **diffusé en temps réel** via WebSocket aux membres connectés du canal.

---

## Messages — temps réel (WebSocket)

Endpoint : **`ws://<host>/ws`**. Authentification par le même JWT (cookie `chat_token` ou
`Authorization: Bearer`). La connexion est refusée (`1008 Unauthorized`) sans token valide.

Le serveur relaie chaque nouveau message **uniquement** aux clients connectés qui sont membres du
canal concerné (et donc de la même organisation) :

```json
{ "type": "new_message", "data": { "id": 3, "channel_id": 1, "user_id": 1, "content": "...", "org_id": 1, "created_at": "..." } }
```

---

## Documentation interactive

- **`GET /api/docs`** — Swagger UI (OpenAPI 3.0), généré depuis `chat-backend/src/swagger.ts`.
  Couvre l'ensemble des routes REST (`Auth`, `Users`, `Organisation`, `Teams`, `Channels`).
  Le WebSocket temps réel (`/ws`) n'y figure pas — voir la section ci-dessus.

## Hors périmètre API actuel

Le schéma de base prévoit **documents** (pièces jointes) et **réactions** emoji (tables
`documents`, `message_reaction_users`), mais **aucune route HTTP ne les expose encore**. De même,
la gestion des **rôles/permissions** est pilotée par migrations (seed RBAC), sans endpoint
d'administration dédié.
