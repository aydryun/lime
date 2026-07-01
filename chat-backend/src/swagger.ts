// Document OpenAPI servi par Swagger UI sur GET /api/docs.
// Reflète les routes réellement implémentées (auth, users, org, teams, channels).
// Voir aussi docs/api-routes.md (référence complète, incluant le WebSocket /ws).

const bearer = [{ bearerAuth: [] }];
const jsonError = { $ref: "#/components/schemas/Error" };

/** Construit une réponse JSON référençant un schéma. */
function json(description: string, schema: object) {
  return {
    description,
    content: { "application/json": { schema } },
  };
}

/** Réponse d'erreur standard `{ error }`. */
function err(description: string) {
  return json(description, jsonError);
}

const swaggerDocument = {
  openapi: "3.0.3",
  info: {
    title: "Lime API",
    description:
      "API de messagerie professionnelle Lime — multi-tenant, RBAC scopé (org / équipe / canal), temps réel via WebSocket (/ws, non décrit ici). Toutes les routes hors Auth exigent un JWT (cookie HttpOnly `chat_token` ou header `Authorization: Bearer`) et sont scopées à l'organisation du token.",
    version: "1.0.0",
  },
  servers: [{ url: "/api", description: "Serveur API (préfixe /api)" }],
  tags: [
    {
      name: "Auth",
      description: "Inscription, connexion, activation de compte",
    },
    { name: "Users", description: "Profil de l'utilisateur connecté" },
    {
      name: "Organisation",
      description: "Infos entreprise et gestion des membres",
    },
    { name: "Teams", description: "Équipes hiérarchiques et leurs membres" },
    { name: "Channels", description: "Canaux, membres et messages" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string", example: "Message d'erreur" },
        },
      },
      Message200: {
        type: "object",
        properties: { message: { type: "string" } },
      },
      UserPublic: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          firstname: { type: "string", example: "Lucas" },
          lastname: { type: "string", example: "Martin" },
          email: { type: "string", example: "lucas@lime.app" },
          username: { type: "string", example: "lucas" },
          org_id: { type: "integer", example: 1 },
        },
      },
      Organisation: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          nom: { type: "string", example: "Milestone" },
          raison_sociale: { type: "string", nullable: true },
          siren: { type: "string", nullable: true, example: "123456789" },
          siret: { type: "string", nullable: true, example: "12345678900012" },
          tva_intracommunautaire: { type: "string", nullable: true },
          email: {
            type: "string",
            nullable: true,
            example: "contact@milestone.fr",
          },
          telephone: { type: "string", nullable: true },
          adresse: { type: "string", nullable: true },
          code_postal: { type: "string", nullable: true },
          ville: { type: "string", nullable: true },
          pays: { type: "string", nullable: true },
          created_at: { type: "string", example: "2026-04-10T10:00:00.000Z" },
          updated_at: { type: "string", example: "2026-04-10T10:00:00.000Z" },
        },
      },
      OrgMember: {
        type: "object",
        properties: {
          id: { type: "integer", example: 2 },
          firstname: { type: "string", example: "Julie" },
          lastname: { type: "string", example: "Dupont" },
          email: { type: "string", example: "julie@lime.app" },
          username: { type: "string", example: "julie" },
          role: {
            type: "string",
            nullable: true,
            enum: ["org_owner", "org_admin", "member"],
            example: "member",
          },
          activated: { type: "boolean", example: true },
        },
      },
      Team: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Développeurs" },
          org_id: { type: "integer", example: 1 },
          parent_team_id: { type: "integer", nullable: true, example: null },
          member_count: { type: "integer", example: 3 },
        },
      },
      TeamMember: {
        type: "object",
        properties: {
          user_id: { type: "integer", example: 2 },
          username: { type: "string", example: "julie" },
          firstname: { type: "string", example: "Julie" },
          lastname: { type: "string", example: "Dupont" },
          role: {
            type: "string",
            enum: ["team_owner", "team_admin", "team_member"],
            example: "team_member",
          },
        },
      },
      Channel: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "général" },
          my_role: {
            type: "string",
            enum: [
              "canal_owner",
              "canal_admin",
              "canal_member",
              "canal_reader",
            ],
            example: "canal_member",
          },
        },
      },
      ChannelMember: {
        type: "object",
        properties: {
          user_id: { type: "integer", example: 2 },
          username: { type: "string", example: "julie" },
          firstname: { type: "string", example: "Julie" },
          lastname: { type: "string", example: "Dupont" },
          role: {
            type: "string",
            enum: [
              "canal_owner",
              "canal_admin",
              "canal_member",
              "canal_reader",
            ],
            example: "canal_member",
          },
        },
      },
      ChannelMessage: {
        type: "object",
        properties: {
          id: { type: "integer", example: 3 },
          channel_id: { type: "integer", example: 1 },
          user_id: { type: "integer", example: 1 },
          sender: { type: "string", example: "lucas" },
          content: { type: "string", example: "Bonjour à tous !" },
          is_updated: { type: "boolean", example: false },
          is_pinned: { type: "boolean", example: false },
          created_at: { type: "string", example: "2026-04-10T10:30:00.000Z" },
        },
      },
    },
  },
  paths: {
    // ─── Auth ────────────────────────────────────────────────────────────
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Crée un compte et son organisation",
        description:
          "Le nouvel utilisateur devient org_owner d'une nouvelle organisation. `organisation` est optionnel.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: [
                  "firstname",
                  "lastname",
                  "email",
                  "username",
                  "password",
                ],
                properties: {
                  firstname: { type: "string", example: "Lucas" },
                  lastname: { type: "string", example: "Martin" },
                  email: { type: "string", example: "lucas@lime.app" },
                  username: { type: "string", example: "lucas" },
                  password: { type: "string", example: "secret123" },
                  organisation: { type: "string", example: "Milestone" },
                },
              },
            },
          },
        },
        responses: {
          "201": json("Utilisateur créé", {
            $ref: "#/components/schemas/UserPublic",
          }),
          "400": err("Champs manquants"),
          "409": err("Email déjà utilisé"),
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Connexion, retourne un token JWT et pose le cookie",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", example: "lucas@lime.app" },
                  password: { type: "string", example: "secret123" },
                },
              },
            },
          },
        },
        responses: {
          "200": json(
            "Connexion réussie (pose aussi le cookie HttpOnly chat_token)",
            {
              type: "object",
              properties: {
                token: { type: "string", example: "eyJhbGciOiJIUzI1NiIs..." },
                user: { $ref: "#/components/schemas/UserPublic" },
              },
            },
          ),
          "400": err("Email ou mot de passe manquant"),
          "401": err("Identifiants invalides"),
          "403": err("Compte non activé"),
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Déconnexion (efface le cookie)",
        security: bearer,
        responses: {
          "200": json("Déconnexion réussie", {
            $ref: "#/components/schemas/Message200",
          }),
          "401": err("Token manquant ou invalide"),
        },
      },
    },
    "/auth/activate": {
      post: {
        tags: ["Auth"],
        summary:
          "Un membre invité définit son mot de passe via le token reçu par email",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "password"],
                properties: {
                  token: { type: "string", example: "eyJhbGciOiJIUzI1NiIs..." },
                  password: {
                    type: "string",
                    example: "secret123",
                    minLength: 8,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": json("Compte activé", {
            $ref: "#/components/schemas/Message200",
          }),
          "400": err("Token/mot de passe manquant ou trop court"),
          "401": err("Token invalide ou expiré"),
          "404": err("Compte introuvable"),
        },
      },
    },

    // ─── Users ───────────────────────────────────────────────────────────
    "/users/me": {
      put: {
        tags: ["Users"],
        summary: "Met à jour le profil de l'utilisateur connecté",
        security: bearer,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["firstname", "lastname", "email", "username"],
                properties: {
                  firstname: { type: "string", example: "Lucas" },
                  lastname: { type: "string", example: "Martin" },
                  email: { type: "string", example: "lucas@lime.app" },
                  username: { type: "string", example: "lucas_m" },
                },
              },
            },
          },
        },
        responses: {
          "200": json("Profil mis à jour", {
            $ref: "#/components/schemas/UserPublic",
          }),
          "400": err("Champs manquants ou invalides"),
          "401": err("Non authentifié"),
          "404": err("Utilisateur introuvable"),
          "409": err("Email ou username déjà utilisé"),
        },
      },
    },
    "/users/me/password": {
      put: {
        tags: ["Users"],
        summary: "Change le mot de passe de l'utilisateur connecté",
        security: bearer,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["currentPassword", "newPassword"],
                properties: {
                  currentPassword: { type: "string", example: "secret123" },
                  newPassword: {
                    type: "string",
                    example: "nouveaumdp123",
                    minLength: 8,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": json("Mot de passe mis à jour", {
            $ref: "#/components/schemas/Message200",
          }),
          "400": err("Champs manquants ou mot de passe trop court"),
          "401": err("Non authentifié ou mot de passe actuel invalide"),
          "404": err("Utilisateur introuvable"),
        },
      },
    },

    // ─── Organisation ──────────────────────────────────────────────────────
    "/org": {
      get: {
        tags: ["Organisation"],
        summary: "Infos de l'organisation courante",
        security: bearer,
        responses: {
          "200": json("Organisation", {
            $ref: "#/components/schemas/Organisation",
          }),
          "401": err("Non authentifié"),
          "404": err("Organisation introuvable"),
        },
      },
      patch: {
        tags: ["Organisation"],
        summary: "Met à jour les infos entreprise (permission org:UPDATE)",
        description:
          'Champs modifiables : nom (obligatoire), raison_sociale, siren (9 chiffres), siret (14 chiffres), tva_intracommunautaire, email, telephone, adresse, code_postal, ville, pays. null/"" efface un champ (sauf nom).',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  nom: { type: "string", example: "Milestone" },
                  raison_sociale: { type: "string", nullable: true },
                  siren: { type: "string", example: "123456789" },
                  siret: { type: "string", example: "12345678900012" },
                  tva_intracommunautaire: { type: "string" },
                  email: { type: "string", example: "contact@milestone.fr" },
                  telephone: { type: "string" },
                  adresse: { type: "string" },
                  code_postal: { type: "string" },
                  ville: { type: "string" },
                  pays: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": json("Organisation mise à jour", {
            $ref: "#/components/schemas/Organisation",
          }),
          "400": err("Validation échouée / aucun champ"),
          "403": err("Permission refusée"),
          "409": err("SIREN ou email déjà pris par une autre organisation"),
        },
      },
    },
    "/org/members": {
      get: {
        tags: ["Organisation"],
        summary: "Liste des membres de l'organisation",
        security: bearer,
        responses: {
          "200": json("Membres", {
            type: "array",
            items: { $ref: "#/components/schemas/OrgMember" },
          }),
          "401": err("Non authentifié"),
        },
      },
      post: {
        tags: ["Organisation"],
        summary:
          "Invite un membre (permission member:CREATE, envoie un email d'activation)",
        security: bearer,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["firstname", "lastname", "username", "email"],
                properties: {
                  firstname: { type: "string", example: "Julie" },
                  lastname: { type: "string", example: "Dupont" },
                  username: { type: "string", example: "julie" },
                  email: { type: "string", example: "julie@lime.app" },
                  role: {
                    type: "string",
                    enum: ["org_admin", "member"],
                    example: "member",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": json(
            "Membre créé (emailSent indique si l'invitation a été envoyée)",
            {
              allOf: [
                { $ref: "#/components/schemas/UserPublic" },
                {
                  type: "object",
                  properties: {
                    role: { type: "string", example: "member" },
                    emailSent: { type: "boolean", example: true },
                  },
                },
              ],
            },
          ),
          "400": err("Champs manquants ou email invalide"),
          "403": err("Permission refusée"),
          "409": err("Email ou username déjà utilisé"),
        },
      },
    },
    "/org/members/{userId}": {
      parameters: [
        {
          name: "userId",
          in: "path",
          required: true,
          schema: { type: "integer" },
        },
      ],
      patch: {
        tags: ["Organisation"],
        summary: "Change le rôle d'org d'un membre (permission member:UPDATE)",
        security: bearer,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["role"],
                properties: {
                  role: {
                    type: "string",
                    enum: ["org_admin", "member"],
                    example: "org_admin",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": json("Rôle mis à jour", {
            type: "object",
            properties: {
              id: { type: "integer", example: 2 },
              role: { type: "string", example: "org_admin" },
            },
          }),
          "400": err("Rôle invalide"),
          "403": err(
            "Le rôle du propriétaire est immuable / permission refusée",
          ),
          "404": err("Membre introuvable"),
        },
      },
      delete: {
        tags: ["Organisation"],
        summary:
          "Retire un membre de l'organisation (permission member:DELETE)",
        security: bearer,
        responses: {
          "204": { description: "Membre retiré" },
          "400": err("Impossible de se retirer soi-même"),
          "403": err("Le propriétaire est protégé / permission refusée"),
          "404": err("Membre introuvable"),
          "409": err("Le membre a des messages ou documents"),
        },
      },
    },

    // ─── Teams ───────────────────────────────────────────────────────────
    "/teams": {
      get: {
        tags: ["Teams"],
        summary:
          "Liste des équipes (toutes si manager d'org, sinon les siennes)",
        security: bearer,
        responses: {
          "200": json("Équipes", {
            type: "array",
            items: { $ref: "#/components/schemas/Team" },
          }),
          "401": err("Non authentifié"),
        },
      },
      post: {
        tags: ["Teams"],
        summary: "Crée une équipe (ou une sous-équipe avec parent_team_id)",
        description:
          "Permission team:CREATE, vérifiée au scope du parent (cascade) ; sans parent, réservé aux managers d'org.",
        security: bearer,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", example: "Marketing" },
                  parent_team_id: {
                    type: "integer",
                    nullable: true,
                    example: 1,
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": json("Équipe créée", { $ref: "#/components/schemas/Team" }),
          "400": err("Nom ou parent_team_id invalide"),
          "403": err("Permission refusée"),
          "404": err("Équipe parente introuvable"),
        },
      },
    },
    "/teams/{id}": {
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "integer" } },
      ],
      get: {
        tags: ["Teams"],
        summary: "Détail d'une équipe et de ses membres",
        security: bearer,
        responses: {
          "200": json("Équipe + membres", {
            allOf: [
              { $ref: "#/components/schemas/Team" },
              {
                type: "object",
                properties: {
                  members: {
                    type: "array",
                    items: { $ref: "#/components/schemas/TeamMember" },
                  },
                },
              },
            ],
          }),
          "403": err("Permission refusée"),
          "404": err("Équipe introuvable"),
        },
      },
      patch: {
        tags: ["Teams"],
        summary: "Renomme une équipe (permission team:UPDATE)",
        security: bearer,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", example: "Marketing & Com" },
                },
              },
            },
          },
        },
        responses: {
          "200": json("Équipe renommée", { $ref: "#/components/schemas/Team" }),
          "400": err("Nom invalide"),
          "403": err("Permission refusée"),
          "404": err("Équipe introuvable"),
        },
      },
      delete: {
        tags: ["Teams"],
        summary: "Supprime une équipe (permission team:DELETE)",
        security: bearer,
        responses: {
          "204": {
            description:
              "Équipe supprimée (sous-équipes réattachées au parent)",
          },
          "403": err("Permission refusée"),
          "404": err("Équipe introuvable"),
        },
      },
    },
    "/teams/{id}/members": {
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "integer" } },
      ],
      get: {
        tags: ["Teams"],
        summary: "Membres d'une équipe",
        security: bearer,
        responses: {
          "200": json("Membres", {
            type: "array",
            items: { $ref: "#/components/schemas/TeamMember" },
          }),
          "403": err("Permission refusée"),
          "404": err("Équipe introuvable"),
        },
      },
      post: {
        tags: ["Teams"],
        summary:
          "Ajoute un membre (permission team:UPDATE + périmètre d'autorité)",
        security: bearer,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userId"],
                properties: {
                  userId: { type: "integer", example: 3 },
                  role: {
                    type: "string",
                    enum: ["team_admin", "team_member"],
                    example: "team_member",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": json("Membre ajouté", {
            type: "object",
            properties: {
              team_id: { type: "integer", example: 1 },
              user_id: { type: "integer", example: 3 },
              role: { type: "string", example: "team_member" },
            },
          }),
          "400": err("userId invalide ou utilisateur hors de l'organisation"),
          "403": err("Hors de votre périmètre / permission refusée"),
          "404": err("Équipe introuvable"),
          "409": err("Déjà membre de l'équipe"),
        },
      },
    },
    "/teams/{id}/members/{userId}": {
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "integer" } },
        {
          name: "userId",
          in: "path",
          required: true,
          schema: { type: "integer" },
        },
      ],
      patch: {
        tags: ["Teams"],
        summary: "Change le rôle d'un membre (permission team:UPDATE)",
        description:
          "La promotion en team_owner (transfert de propriété) est réservée au manager d'org et au propriétaire actuel.",
        security: bearer,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["role"],
                properties: {
                  role: {
                    type: "string",
                    enum: ["team_owner", "team_admin", "team_member"],
                    example: "team_admin",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": json("Rôle mis à jour", {
            type: "object",
            properties: {
              team_id: { type: "integer", example: 1 },
              user_id: { type: "integer", example: 3 },
              role: { type: "string", example: "team_admin" },
            },
          }),
          "400": err("Rôle ou identifiant invalide"),
          "403": err("Permission refusée"),
          "404": err("Équipe ou membre introuvable"),
        },
      },
      delete: {
        tags: ["Teams"],
        summary: "Retire un membre (permission team:UPDATE, ou soi-même)",
        security: bearer,
        responses: {
          "204": { description: "Membre retiré" },
          "403": err("Permission refusée"),
          "404": err("Équipe ou membre introuvable"),
        },
      },
    },

    // ─── Channels ──────────────────────────────────────────────────────────
    "/channels": {
      get: {
        tags: ["Channels"],
        summary: "Canaux auxquels l'utilisateur appartient (avec my_role)",
        security: bearer,
        responses: {
          "200": json("Canaux", {
            type: "array",
            items: { $ref: "#/components/schemas/Channel" },
          }),
          "401": err("Non authentifié"),
        },
      },
      post: {
        tags: ["Channels"],
        summary: "Crée un canal",
        description:
          "mode (défaut private) : private | org | team | team_subtree | members. team/team_subtree exigent team_id ; members exige user_ids (entiers > 0, dédupliqués, max 500). default_role : rôle attribué aux membres ajoutés via le lien.",
        security: bearer,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", example: "général" },
                  mode: {
                    type: "string",
                    enum: ["private", "org", "team", "team_subtree", "members"],
                    example: "private",
                  },
                  default_role: {
                    type: "string",
                    enum: ["canal_admin", "canal_member", "canal_reader"],
                    example: "canal_member",
                  },
                  team_id: { type: "integer", example: 1 },
                  user_ids: {
                    type: "array",
                    items: { type: "integer" },
                    example: [2, 3],
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": json("Canal créé (le créateur est canal_owner)", {
            $ref: "#/components/schemas/Channel",
          }),
          "400": err("Paramètres invalides (mode, default_role, user_ids…)"),
          "403": err("Permission refusée selon le mode"),
          "404": err("Équipe introuvable"),
        },
      },
    },
    "/channels/{id}": {
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "integer" } },
      ],
      patch: {
        tags: ["Channels"],
        summary: "Renomme un canal (propriétaire uniquement)",
        security: bearer,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: { name: { type: "string", example: "général-v2" } },
              },
            },
          },
        },
        responses: {
          "200": json("Canal renommé", {
            $ref: "#/components/schemas/Channel",
          }),
          "403": err("Seul le propriétaire peut renommer"),
          "404": err("Canal introuvable"),
        },
      },
      delete: {
        tags: ["Channels"],
        summary: "Supprime un canal (propriétaire uniquement)",
        security: bearer,
        responses: {
          "200": json("Canal supprimé", {
            $ref: "#/components/schemas/Message200",
          }),
          "403": err("Seul le propriétaire peut supprimer"),
          "404": err("Canal introuvable"),
        },
      },
    },
    "/channels/{id}/members": {
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "integer" } },
      ],
      get: {
        tags: ["Channels"],
        summary: "Membres d'un canal avec leurs rôles",
        security: bearer,
        responses: {
          "200": json("Membres", {
            type: "array",
            items: { $ref: "#/components/schemas/ChannelMember" },
          }),
          "403": err("Accès refusé"),
        },
      },
      post: {
        tags: ["Channels"],
        summary: "Ajoute un membre (propriétaire ou admin)",
        security: bearer,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userId"],
                properties: { userId: { type: "integer", example: 2 } },
              },
            },
          },
        },
        responses: {
          "201": json("Membre ajouté", {
            type: "object",
            properties: { added: { type: "boolean", example: true } },
          }),
          "200": json("Déjà membre", {
            type: "object",
            properties: { added: { type: "boolean", example: false } },
          }),
          "400": err("userId requis"),
          "403": err("Accès refusé"),
          "404": err("Canal ou utilisateur introuvable"),
        },
      },
    },
    "/channels/{id}/non-members": {
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "integer" } },
        {
          name: "q",
          in: "query",
          required: false,
          schema: { type: "string" },
          description: "Filtre de recherche (username, prénom, nom)",
        },
      ],
      get: {
        tags: ["Channels"],
        summary: "Utilisateurs non membres du canal (propriétaire ou admin)",
        security: bearer,
        responses: {
          "200": json("Utilisateurs", {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "integer", example: 4 },
                username: { type: "string", example: "kevin" },
                firstname: { type: "string", example: "Kevin" },
                lastname: { type: "string", example: "Bernard" },
              },
            },
          }),
          "403": err("Accès refusé"),
        },
      },
    },
    "/channels/{id}/members/{userId}": {
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "integer" } },
        {
          name: "userId",
          in: "path",
          required: true,
          schema: { type: "integer" },
        },
      ],
      patch: {
        tags: ["Channels"],
        summary: "Change le rôle d'un membre (propriétaire uniquement)",
        security: bearer,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["role"],
                properties: {
                  role: {
                    type: "string",
                    enum: ["canal_admin", "canal_member", "canal_reader"],
                    example: "canal_admin",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": json("Rôle mis à jour", {
            type: "object",
            properties: { role: { type: "string", example: "canal_admin" } },
          }),
          "400": err("Rôle invalide"),
          "403": err("Seul le propriétaire peut changer les rôles"),
          "404": err("Membre introuvable"),
          "409": err("Impossible de changer le rôle du propriétaire"),
        },
      },
      delete: {
        tags: ["Channels"],
        summary: "Retire un membre ou quitte le canal",
        description:
          "Propriétaire/admin peut retirer autrui (un admin ne retire ni un autre admin ni le propriétaire) ; un membre peut se retirer. Un propriétaire seul qui quitte supprime le canal ; s'il reste des membres, il doit transférer/supprimer d'abord (409 OWNER_HAS_MEMBERS).",
        security: bearer,
        responses: {
          "200": json(
            "Membre retiré (ou canal supprimé si propriétaire seul)",
            {
              $ref: "#/components/schemas/Message200",
            },
          ),
          "403": err("Accès refusé"),
          "404": err("Membre introuvable"),
          "409": err(
            "Le propriétaire doit transférer/supprimer d'abord (OWNER_HAS_MEMBERS)",
          ),
        },
      },
    },
    "/channels/{id}/transfer": {
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "integer" } },
      ],
      post: {
        tags: ["Channels"],
        summary: "Transfère la propriété du canal (propriétaire uniquement)",
        description:
          "Le propriétaire cède le canal à un membre existant et redevient membre.",
        security: bearer,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userId"],
                properties: { userId: { type: "integer", example: 2 } },
              },
            },
          },
        },
        responses: {
          "200": json("Propriété transférée", {
            $ref: "#/components/schemas/Message200",
          }),
          "400": err("Nouveau propriétaire invalide"),
          "403": err("Seul le propriétaire peut transférer"),
          "404": err("Utilisateur cible non membre"),
        },
      },
    },
    "/channels/{id}/messages": {
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "integer" } },
      ],
      get: {
        tags: ["Channels"],
        summary: "Messages du canal (du plus ancien au plus récent)",
        security: bearer,
        responses: {
          "200": json("Messages", {
            type: "array",
            items: { $ref: "#/components/schemas/ChannelMessage" },
          }),
          "403": err("Accès refusé"),
        },
      },
      post: {
        tags: ["Channels"],
        summary: "Envoie un message (membre, sauf canal_reader)",
        description:
          "Le message est diffusé en temps réel via WebSocket aux membres connectés du canal.",
        security: bearer,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["content"],
                properties: {
                  content: {
                    type: "string",
                    example: "Bonjour à tous !",
                    maxLength: 4000,
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": json("Message créé", {
            $ref: "#/components/schemas/ChannelMessage",
          }),
          "400": err("Contenu manquant ou trop long (> 4000)"),
          "403": err("Accès refusé ou lecture seule (canal_reader)"),
        },
      },
    },
  },
};

export default swaggerDocument;
