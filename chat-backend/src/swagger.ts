const swaggerDocument = {
  openapi: "3.0.3",
  info: {
    title: "Lime API",
    description: "API de messagerie professionnelle Lime",
    version: "1.0.0",
  },
  servers: [
    {
      url: "/api",
      description: "API server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          firstname: { type: "string", example: "Lucas" },
          lastname: { type: "string", example: "Martin" },
          email: { type: "string", example: "lucas@lime.app" },
          username: { type: "string", example: "lucas" },
          password: { type: "string", example: "password123" },
          created_at: { type: "string", example: "2026-04-10T10:00:00.000Z" },
          updated_at: { type: "string", example: "2026-04-10T10:00:00.000Z" },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Créer un compte",
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
                  password: { type: "string", example: "password123" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Utilisateur créé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          "400": {
            description: "Champs manquants",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "409": {
            description: "Email déjà utilisé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Connexion, retourne un token JWT",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", example: "lucas@lime.app" },
                  password: { type: "string", example: "password123" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Connexion réussie",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    token: {
                      type: "string",
                      example: "eyJhbGciOiJIUzI1NiIs...",
                    },
                    user: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Email ou mot de passe manquant",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Identifiants invalides",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Déconnexion",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Déconnexion réussie",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: {
                      type: "string",
                      example: "Déconnexion réussie",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/users/me": {
      patch: {
        tags: ["Users"],
        summary: "Mettre à jour le profil de l'utilisateur connecté",
        security: [{ bearerAuth: [] }],
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
                  username: { type: "string", example: "lucas" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Profil mis à jour",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          "400": {
            description: "Champs manquants",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Non authentifié",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "409": {
            description: "Email ou username déjà utilisé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/users/me/password": {
      post: {
        tags: ["Users"],
        summary: "Changer le mot de passe de l'utilisateur connecté",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["currentPassword", "newPassword"],
                properties: {
                  currentPassword: { type: "string", example: "password123" },
                  newPassword: { type: "string", example: "nouveaumdp123" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Mot de passe mis à jour",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: {
                      type: "string",
                      example: "Mot de passe mis à jour",
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Champs manquants ou mot de passe trop court",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Non authentifié ou mot de passe actuel invalide",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
  },
};

export default swaggerDocument;
