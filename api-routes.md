# API Routes — Lime

> Routes minimalistes, préfixe `/api`.

---

## Auth


| Méthode | Route                | Description                  |
| ------- | -------------------- | ---------------------------- |
| POST    | `/api/auth/register` | Créer un compte              |
| POST    | `/api/auth/login`    | Connexion, retourne un token |
| POST    | `/api/auth/logout`   | Déconnexion                  |


---

## Users


| Méthode | Route            | Description                                         |
| ------- | ---------------- | --------------------------------------------------- |
| GET     | `/api/users/:id` | Récupérer un utilisateur                            |
| PUT     | `/api/users/:id` | Modifier son profil (firstname, lastname, username) |
| DELETE  | `/api/users/:id` | Supprimer un compte                                 |


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


---

## Messages


| Méthode | Route                      | Description                         |
| ------- | -------------------------- | ----------------------------------- |
| GET     | `/api/canaux/:id/messages` | Lister les messages d'un canal      |
| POST    | `/api/canaux/:id/messages` | Envoyer un message (`{ content }`)  |
| PUT     | `/api/messages/:id`        | Modifier un message (`{ content }`) |
| DELETE  | `/api/messages/:id`        | Supprimer un message                |
| PUT     | `/api/messages/:id/pin`    | Épingler / désépingler un message   |


### Réactions


| Méthode | Route                         | Description                           |
| ------- | ----------------------------- | ------------------------------------- |
| GET     | `/api/messages/:id/reactions` | Lister les réactions d'un message     |
| POST    | `/api/messages/:id/reactions` | Ajouter une réaction (`{ reaction }`) |
| DELETE  | `/api/messages/:id/reactions` | Retirer sa réaction                   |


---

## Documents


| Méthode | Route                         | Description                         |
| ------- | ----------------------------- | ----------------------------------- |
| POST    | `/api/canaux/:id/documents`   | Uploader un fichier dans un canal   |
| GET     | `/api/messages/:id/documents` | Récupérer les fichiers d'un message |
| DELETE  | `/api/documents/:id`          | Supprimer un fichier                |


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


