# Fonctionnalités — Lime

> Description de ce qui est **réellement implémenté** dans `chat-backend/` et `chat-client/`.
> Source de vérité : le code. Pour le détail des endpoints, voir [api-routes.md](api-routes.md).

Lime est une messagerie professionnelle **multi-tenant** : plusieurs organisations
cohabitent sur la même instance, totalement isolées les unes des autres. À l'intérieur
d'une organisation, la collaboration s'articule autour d'**équipes hiérarchiques**, de
**canaux** de discussion et d'un modèle d'autorisation **RBAC** scopé.

---

## 1. Multi-tenant : l'organisation comme frontière

- L'**organisation** est la frontière d'isolation stricte. Chaque `user`, `team`,
  `channel`, `message` et `document` porte un `org_id NOT NULL` ; **aucune donnée ne
  traverse une organisation**.
- **Un utilisateur appartient à une seule organisation.** L'email est unique globalement
  (identifiant de connexion), mais le `username` n'est unique que **par organisation**.
- L'**inscription crée l'organisation** : le premier utilisateur en devient `org_owner`
  (aucune FK circulaire org ↔ user — le propriétaire est porté par un rôle).
- Le token JWT embarque `{ userId, orgId }` ; toutes les requêtes sont implicitement
  scopées à cet `orgId`. L'isolation est **verrouillée au niveau SQL** (FK composites
  `(id, org_id)`) pour les liens équipes ↔ parents et canaux ↔ équipes/membres, afin
  qu'aucun import, backfill ou code futur ne puisse créer un lien inter-tenant.

## 2. Authentification & cycle de vie du compte

- **Inscription** (`POST /api/auth/register`) : crée le compte + son organisation.
- **Connexion** (`POST /api/auth/login`) : vérifie le mot de passe (bcrypt), émet un JWT
  valable **24 h**, posé en cookie **HttpOnly** `chat_token` **et** renvoyé dans le corps
  (le front l'envoie ensuite en `Authorization: Bearer`, car back et front sont sur des
  domaines distincts en production).
- **Déconnexion** (`POST /api/auth/logout`) : efface le cookie.
- **Invitation différée** : un manager crée un membre (`POST /api/org/members`) avec un
  mot de passe aléatoire inutilisable et `activated_at = NULL`. Un **email d'invitation**
  contient un token d'activation (valable **7 jours**). Le membre définit son mot de passe
  via `POST /api/auth/activate`. La connexion est **refusée tant que le compte n'est pas
  activé**.

## 3. Organisation & membres

- Consultation / mise à jour des **informations entreprise** (`GET`/`PATCH /api/org`) :
  nom, raison sociale, SIREN (9 chiffres), SIRET (14 chiffres), TVA intracommunautaire,
  email de contact, téléphone, adresse complète. Mise à jour réservée à `org:UPDATE`
  (owner/admin d'org).
- **Annuaire des membres** (`GET /api/org/members`) : accessible à tout membre authentifié
  (indispensable aux sélecteurs d'utilisateurs), avec rôle d'org et statut d'activation.
- **Gestion des membres** : invitation (`member:CREATE`), changement de rôle d'org
  (`member:UPDATE`), retrait (`member:DELETE`). Le **propriétaire d'org est protégé** :
  son rôle est immuable et il ne peut pas être retiré. Un retrait est **refusé** si le
  membre possède encore des messages/documents.

## 4. Équipes hiérarchiques

- CRUD complet des équipes, scopé à l'org.
- **Hiérarchie** : une équipe peut avoir une équipe parente (`parent_team_id`). Une
  équipe racine a `parent_team_id = NULL`.
- **Cascade d'autorité** : un `team_owner` / `team_admin` gère automatiquement toutes les
  **sous-équipes** de son sous-arbre. Il peut y créer des sous-équipes et y ajouter des
  membres sans être manager d'org. La portée est calculée dynamiquement en remontant la
  chaîne `parent_team_id`.
- **Visibilité adaptée** : un manager d'org voit toutes les équipes ; un membre simple ne
  voit que les siennes (et celles qu'il gère par cascade) — pas de `403` global.
- **Recrutement borné** : hors manager d'org, on ne peut ajouter qu'un utilisateur déjà
  sous son autorité (dans son sous-arbre).
- **Propriété d'équipe** : un seul `team_owner` par équipe ; le transfert (promotion en
  `team_owner`) est réservé au manager d'org et au propriétaire courant, et rétrograde
  l'ancien propriétaire. Un membre peut toujours **se retirer** lui-même.
- **Suppression non destructrice de la hiérarchie** : supprimer une équipe **réattache**
  ses sous-équipes au grand-parent (préserve la cascade, évite les orphelines).

## 5. Canaux de discussion

- **Rôles canal** : `canal_owner` (le créateur), `canal_admin`, `canal_member`,
  `canal_reader` (**lecture seule**).
- **Modes de création** (peuplement initial + autorisation) :
  - `private` — le créateur seul (tout authentifié) ;
  - `org` — toute l'organisation (réservé aux managers d'org) ;
  - `team` — les membres directs d'une équipe ;
  - `team_subtree` — l'équipe **et tout son sous-arbre** ;
  - `members` — une liste d'utilisateurs précis (chacun sous l'autorité de l'appelant).
- **Appartenance dynamique** : l'accès d'un membre est recalculé à la volée à partir des
  liens (lien direct, lien d'équipe éventuellement étendu au sous-arbre, statut org-wide).
  Ajouter/retirer quelqu'un d'une équipe, ou créer une sous-équipe, ajuste **immédiatement**
  l'accès aux canaux liés. Le rôle effectif = rôle explicite, sinon le meilleur rôle par
  défaut (`default_role`) des liens applicables.
- **Rôle par défaut** paramétrable à la création (`default_role` : `canal_admin`,
  `canal_member` ou `canal_reader`) pour les membres ajoutés via un lien.
- **Gestion des membres** : ajout/retrait (owner ou admin), recherche des non-membres,
  changement de rôle (owner uniquement), **transfert de propriété**. Règles de retrait :
  un admin ne peut pas retirer un autre admin ni le propriétaire ; le propriétaire qui
  quitte doit d'abord transférer/supprimer s'il reste des membres (sinon quitter =
  supprimer le canal).
- **Robustesse des entrées** : les identifiants sont validés (entiers > 0), la liste
  `user_ids` du mode `members` est **dédupliquée** et **plafonnée** (500).

## 6. Messagerie & temps réel

- Envoi et consultation des **messages** d'un canal (contenu 1–4000 caractères). Un
  `canal_reader` est en lecture seule.
- **Temps réel via WebSocket** (`/ws`) : à l'envoi, le message est publié sur **Redis**
  (Pub/Sub), puis relayé **uniquement** aux clients connectés qui sont membres du canal
  concerné — l'isolation tenant et l'absence de fuite inter-canaux sont garanties côté
  relais. La connexion WebSocket est authentifiée par le même JWT.
- Le schéma prévoit **épinglage** (`is_pinned`), marquage **édité** (`is_updated`),
  **réactions** emoji et **documents** joints, mais ces routes ne sont **pas encore
  exposées** (voir [api-routes.md](api-routes.md#hors-périmètre-api-actuel)).

## 7. RBAC — Rôles & Permissions

Le contrôle d'accès repose sur un point de passage unique côté BDD :
`userHasPermission(userId, category, action, scope)`.

- Une **permission** est un couple `(category, action)` — catégories : `org`, `member`,
  `team`, `channel`, `message` ; actions : `GET`, `CREATE`, `UPDATE`, `DELETE`.
- Un **rôle** agrège des permissions (`role_permissions`) ; un utilisateur reçoit des
  rôles **scopés** (`user_roles`) à **un seul** niveau à la fois : org, équipe **ou** canal.
- **Portée d'un rôle** : un rôle org-scopé couvre toute l'org ; un rôle canal-scopé ne
  couvre que son canal ; un rôle team-scopé couvre l'équipe ciblée **et tout son
  sous-arbre** (cascade, via la CTE récursive `team_chain`, verrouillée sur l'org du scope).

Le détail des tables et du seed RBAC est dans
[database/database.md](database/database.md#rbac--rôles--permissions).

## 8. Frontend (chat-client)

Application **Next.js** (App Router). Pages principales : connexion/inscription
(`/login`), messagerie (`/chat`), paramètres (`/settings` — profil, mot de passe,
organisation, équipes). Un **middleware proxy** filtre les routes via un cookie indicateur
non-HttpOnly (le vrai JWT reste en `localStorage` et voyage en header `Bearer`).
Préférences locales : langue d'interface (fr/en) et notifications.

---

## Récapitulatif des rôles

| Niveau | Rôles | Portée |
|---|---|---|
| Organisation | `org_owner`, `org_admin`, `member` | toute l'org |
| Équipe | `team_owner`, `team_admin`, `team_member` | l'équipe + son sous-arbre (cascade) |
| Canal | `canal_owner`, `canal_admin`, `canal_member`, `canal_reader` | le canal |
