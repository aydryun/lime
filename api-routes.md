# API Routes — Lime

> Routes minimalistes, préfixe `/api`.

---

## Auth

| Méthode | Route                | Description                  |
| ------- | -------------------- | ---------------------------- |
| POST    | `/api/auth/register` | Créer un compte              |
| POST    | `/api/auth/login`    | Connexion, retourne un token |
| POST    | `/api/auth/logout`   | Déconnexion                  |

### `POST /api/auth/register`

**Body :**
```json
{
  "firstname": "Lucas",
  "lastname": "Martin",
  "email": "lucas@lime.app",
  "username": "lucas",
  "password": "secret123"
}
```

**Réponse `201` :**
```json
{
  "id": 1,
  "firstname": "Lucas",
  "lastname": "Martin",
  "email": "lucas@lime.app",
  "username": "lucas"
}
```

### `POST /api/auth/login`

**Body :**
```json
{
  "email": "lucas@lime.app",
  "password": "secret123"
}
```

**Réponse `200` :**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "firstname": "Lucas",
    "lastname": "Martin",
    "email": "lucas@lime.app",
    "username": "lucas"
  }
}
```

### `POST /api/auth/logout`

**Réponse `200` :**
```json
{
  "message": "Déconnexion réussie"
}
```

---

## Users

| Méthode | Route            | Description                                         |
| ------- | ---------------- | --------------------------------------------------- |
| GET     | `/api/users/:id` | Récupérer un utilisateur                            |
| PUT     | `/api/users/:id` | Modifier son profil (firstname, lastname, username) |
| DELETE  | `/api/users/:id` | Supprimer un compte                                 |

### `GET /api/users/:id`

**Réponse `200` :**
```json
{
  "id": 1,
  "firstname": "Lucas",
  "lastname": "Martin",
  "email": "lucas@lime.app",
  "username": "lucas"
}
```

### `PUT /api/users/:id`

**Body :**
```json
{
  "firstname": "Lucas",
  "lastname": "Martin",
  "username": "lucas_m"
}
```

**Réponse `200` :**
```json
{
  "id": 1,
  "firstname": "Lucas",
  "lastname": "Martin",
  "email": "lucas@lime.app",
  "username": "lucas_m"
}
```

### `DELETE /api/users/:id`

**Réponse `200` :**
```json
{
  "message": "Utilisateur supprimé"
}
```

---

## Teams

| Méthode | Route                            | Description                      |
| ------- | -------------------------------- | -------------------------------- |
| GET     | `/api/teams`                     | Lister les équipes               |
| POST    | `/api/teams`                     | Créer une équipe                 |
| GET     | `/api/teams/:id`                 | Détail d'une équipe              |
| PUT     | `/api/teams/:id`                 | Modifier une équipe              |
| DELETE  | `/api/teams/:id`                 | Supprimer une équipe             |
| GET     | `/api/teams/:id/members`         | Lister les membres               |
| POST    | `/api/teams/:id/members`         | Ajouter un membre (`{ idUser }`) |
| DELETE  | `/api/teams/:id/members/:userId` | Retirer un membre                |

### `GET /api/teams`

**Réponse `200` :**
```json
[
  { "id": 1, "name": "Développeurs" },
  { "id": 2, "name": "Design" }
]
```

### `POST /api/teams`

**Body :**
```json
{
  "name": "Marketing"
}
```

**Réponse `201` :**
```json
{
  "id": 3,
  "name": "Marketing"
}
```

### `GET /api/teams/:id`

**Réponse `200` :**
```json
{
  "id": 1,
  "name": "Développeurs"
}
```

### `PUT /api/teams/:id`

**Body :**
```json
{
  "name": "Développeurs Backend"
}
```

**Réponse `200` :**
```json
{
  "id": 1,
  "name": "Développeurs Backend"
}
```

### `DELETE /api/teams/:id`

**Réponse `200` :**
```json
{
  "message": "Équipe supprimée"
}
```

### `GET /api/teams/:id/members`

**Réponse `200` :**
```json
[
  { "id": 1, "firstname": "Lucas", "lastname": "Martin", "username": "lucas" },
  { "id": 2, "firstname": "Julie", "lastname": "Dupont", "username": "julie" }
]
```

### `POST /api/teams/:id/members`

**Body :**
```json
{
  "idUser": 3
}
```

**Réponse `201` :**
```json
{
  "message": "Membre ajouté"
}
```

### `DELETE /api/teams/:id/members/:userId`

**Réponse `200` :**
```json
{
  "message": "Membre retiré"
}
```

---

## Canaux

| Méthode | Route                             | Description                     |
| ------- | --------------------------------- | ------------------------------- |
| GET     | `/api/teams/:teamId/canaux`       | Lister les canaux d'une équipe  |
| POST    | `/api/teams/:teamId/canaux`       | Créer un canal                  |
| GET     | `/api/canaux/:id`                 | Détail d'un canal               |
| PUT     | `/api/canaux/:id`                 | Modifier un canal               |
| DELETE  | `/api/canaux/:id`                 | Supprimer un canal              |
| POST    | `/api/canaux/:id/members`         | Ajouter un utilisateur au canal |
| DELETE  | `/api/canaux/:id/members/:userId` | Retirer un utilisateur du canal |

### `GET /api/teams/:teamId/canaux`

**Réponse `200` :**
```json
[
  { "id": 1, "name": "général" },
  { "id": 2, "name": "bugs" }
]
```

### `POST /api/teams/:teamId/canaux`

**Body :**
```json
{
  "name": "déploiement"
}
```

**Réponse `201` :**
```json
{
  "id": 3,
  "name": "déploiement"
}
```

### `GET /api/canaux/:id`

**Réponse `200` :**
```json
{
  "id": 1,
  "name": "général"
}
```

### `PUT /api/canaux/:id`

**Body :**
```json
{
  "name": "général-v2"
}
```

**Réponse `200` :**
```json
{
  "id": 1,
  "name": "général-v2"
}
```

### `DELETE /api/canaux/:id`

**Réponse `200` :**
```json
{
  "message": "Canal supprimé"
}
```

### `POST /api/canaux/:id/members`

**Body :**
```json
{
  "idUser": 2
}
```

**Réponse `201` :**
```json
{
  "message": "Utilisateur ajouté au canal"
}
```

### `DELETE /api/canaux/:id/members/:userId`

**Réponse `200` :**
```json
{
  "message": "Utilisateur retiré du canal"
}
```

---

## Messages

| Méthode | Route                      | Description                         |
| ------- | -------------------------- | ----------------------------------- |
| GET     | `/api/canaux/:id/messages` | Lister les messages d'un canal      |
| POST    | `/api/canaux/:id/messages` | Envoyer un message (`{ content }`)  |
| PUT     | `/api/messages/:id`        | Modifier un message (`{ content }`) |
| DELETE  | `/api/messages/:id`        | Supprimer un message                |
| PUT     | `/api/messages/:id/pin`    | Épingler / désépingler un message   |

### `GET /api/canaux/:id/messages`

**Réponse `200` :**
```json
[
  {
    "id": 1,
    "idCanaux": 1,
    "idUser": 1,
    "content": "Bonjour à tous !",
    "isUpdated": false,
    "isPinned": false,
    "createdAt": "2026-04-08T10:30:00Z"
  },
  {
    "id": 2,
    "idCanaux": 1,
    "idUser": 2,
    "content": "Salut Lucas !",
    "isUpdated": false,
    "isPinned": false,
    "createdAt": "2026-04-08T10:31:00Z"
  }
]
```

### `POST /api/canaux/:id/messages`

**Body :**
```json
{
  "content": "Nouveau message ici"
}
```

**Réponse `201` :**
```json
{
  "id": 3,
  "idCanaux": 1,
  "idUser": 1,
  "content": "Nouveau message ici",
  "isUpdated": false,
  "isPinned": false,
  "createdAt": "2026-04-08T11:00:00Z"
}
```

### `PUT /api/messages/:id`

**Body :**
```json
{
  "content": "Message modifié"
}
```

**Réponse `200` :**
```json
{
  "id": 3,
  "idCanaux": 1,
  "idUser": 1,
  "content": "Message modifié",
  "isUpdated": true,
  "isPinned": false,
  "createdAt": "2026-04-08T11:00:00Z"
}
```

### `DELETE /api/messages/:id`

**Réponse `200` :**
```json
{
  "message": "Message supprimé"
}
```

### `PUT /api/messages/:id/pin`

**Réponse `200` :**
```json
{
  "id": 3,
  "idCanaux": 1,
  "idUser": 1,
  "content": "Message modifié",
  "isUpdated": true,
  "isPinned": true,
  "createdAt": "2026-04-08T11:00:00Z"
}
```

### Réactions

| Méthode | Route                         | Description                           |
| ------- | ----------------------------- | ------------------------------------- |
| GET     | `/api/messages/:id/reactions` | Lister les réactions d'un message     |
| POST    | `/api/messages/:id/reactions` | Ajouter une réaction (`{ reaction }`) |
| DELETE  | `/api/messages/:id/reactions` | Retirer sa réaction                   |

### `GET /api/messages/:id/reactions`

**Réponse `200` :**
```json
[
  { "idUser": 1, "reaction": "👍" },
  { "idUser": 2, "reaction": "🎉" }
]
```

### `POST /api/messages/:id/reactions`

**Body :**
```json
{
  "reaction": "👍"
}
```

**Réponse `201` :**
```json
{
  "idMessage": 1,
  "idUser": 1,
  "reaction": "👍"
}
```

### `DELETE /api/messages/:id/reactions`

**Réponse `200` :**
```json
{
  "message": "Réaction retirée"
}
```

---

## Documents

| Méthode | Route                         | Description                         |
| ------- | ----------------------------- | ----------------------------------- |
| POST    | `/api/canaux/:id/documents`   | Uploader un fichier dans un canal   |
| GET     | `/api/messages/:id/documents` | Récupérer les fichiers d'un message |
| DELETE  | `/api/documents/:id`          | Supprimer un fichier                |

### `POST /api/canaux/:id/documents`

**Body :** `multipart/form-data` avec le fichier + `idMessage`

**Réponse `201` :**
```json
{
  "id": 1,
  "idCanaux": 1,
  "idUser": 1,
  "idMessage": 3,
  "type": "image/png",
  "content": "screenshot.png",
  "createdAt": "2026-04-08T11:05:00Z"
}
```

### `GET /api/messages/:id/documents`

**Réponse `200` :**
```json
[
  {
    "id": 1,
    "idCanaux": 1,
    "idUser": 1,
    "idMessage": 3,
    "type": "image/png",
    "content": "screenshot.png",
    "createdAt": "2026-04-08T11:05:00Z"
  }
]
```

### `DELETE /api/documents/:id`

**Réponse `200` :**
```json
{
  "message": "Document supprimé"
}
```

---

## Rôles & Permissions *(admin)*

| Méthode | Route                                | Description                        |
| ------- | ------------------------------------ | ---------------------------------- |
| GET     | `/api/roles`                         | Lister les rôles                   |
| POST    | `/api/roles`                         | Créer un rôle                      |
| PUT     | `/api/roles/:id`                     | Modifier un rôle                   |
| DELETE  | `/api/roles/:id`                     | Supprimer un rôle                  |
| GET     | `/api/permissions`                   | Lister les permissions disponibles |
| POST    | `/api/roles/:id/permissions`         | Assigner une permission à un rôle  |
| DELETE  | `/api/roles/:id/permissions/:permId` | Retirer une permission             |
| POST    | `/api/users/:id/roles`               | Assigner un rôle à un utilisateur  |
| DELETE  | `/api/users/:id/roles/:roleId`       | Retirer un rôle                    |

### `GET /api/roles`

**Réponse `200` :**
```json
[
  { "id": 1, "name": "Admin", "isAdmin": true, "isSuperAdmin": false },
  { "id": 2, "name": "Membre", "isAdmin": false, "isSuperAdmin": false }
]
```

### `POST /api/roles`

**Body :**
```json
{
  "name": "Modérateur",
  "isAdmin": false,
  "isSuperAdmin": false
}
```

**Réponse `201` :**
```json
{
  "id": 3,
  "name": "Modérateur",
  "isAdmin": false,
  "isSuperAdmin": false
}
```

### `PUT /api/roles/:id`

**Body :**
```json
{
  "name": "Super Modérateur",
  "isAdmin": true
}
```

**Réponse `200` :**
```json
{
  "id": 3,
  "name": "Super Modérateur",
  "isAdmin": true,
  "isSuperAdmin": false
}
```

### `DELETE /api/roles/:id`

**Réponse `200` :**
```json
{
  "message": "Rôle supprimé"
}
```

### `GET /api/permissions`

**Réponse `200` :**
```json
[
  { "id": 1, "category": "message", "action": "delete" },
  { "id": 2, "category": "canaux", "action": "create" },
  { "id": 3, "category": "team", "action": "modify" }
]
```

### `POST /api/roles/:id/permissions`

**Body :**
```json
{
  "idPermission": 2
}
```

**Réponse `201` :**
```json
{
  "message": "Permission assignée"
}
```

### `DELETE /api/roles/:id/permissions/:permId`

**Réponse `200` :**
```json
{
  "message": "Permission retirée"
}
```

### `POST /api/users/:id/roles`

**Body :**
```json
{
  "idRole": 1,
  "idTeam": 1,
  "idCanaux": 1
}
```

**Réponse `201` :**
```json
{
  "idUser": 1,
  "idRole": 1,
  "idTeam": 1,
  "idCanaux": 1
}
```

### `DELETE /api/users/:id/roles/:roleId`

**Réponse `200` :**
```json
{
  "message": "Rôle retiré"
}
```
