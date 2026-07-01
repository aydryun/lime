import { beforeAll, describe, expect, test } from "bun:test";
import { api, as, fixtures, json } from "./helpers.js";

// admin = org_owner, julie = org_admin, lucas = member simple.
// Équipes semées : root "Équipe Lime" (admin=owner, julie=admin, lucas=member),
// dev "Dev" enfant de root (lucas=team_owner) — illustre la cascade d'autorité.
let owner = "";
let member = "";

beforeAll(async () => {
  owner = await as.owner();
  member = await as.member();
});

/** Crée une équipe (racine par défaut) en tant qu'owner et renvoie son id. */
async function createTeam(name: string, parent?: number): Promise<number> {
  const res = await api("/teams", owner, {
    method: "POST",
    body: json(parent ? { name, parent_team_id: parent } : { name }),
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: number }).id;
}

describe("GET /teams", () => {
  test("un manager d'org voit toutes les équipes (200)", async () => {
    const res = await api("/teams", owner);
    expect(res.status).toBe(200);
    const teams = (await res.json()) as Array<{ id: number }>;
    const ids = teams.map((t) => t.id);
    expect(ids).toContain(fixtures.teams.root);
    expect(ids).toContain(fixtures.teams.dev);
  });

  test("un membre simple ne voit que ses équipes (200)", async () => {
    const res = await api("/teams", member);
    expect(res.status).toBe(200);
    const ids = ((await res.json()) as Array<{ id: number }>).map((t) => t.id);
    // Lucas est membre de root et owner de dev.
    expect(ids).toContain(fixtures.teams.root);
    expect(ids).toContain(fixtures.teams.dev);
  });

  test("sans authentification (401)", async () => {
    const res = await api("/teams", "");
    expect(res.status).toBe(401);
  });
});

describe("POST /teams", () => {
  test("un manager d'org crée une équipe racine (201)", async () => {
    const res = await api("/teams", owner, {
      method: "POST",
      body: json({ name: "Marketing" }),
    });
    expect(res.status).toBe(201);
  });

  test("un membre simple ne peut pas créer d'équipe racine (403)", async () => {
    const res = await api("/teams", member, {
      method: "POST",
      body: json({ name: "Shadow" }),
    });
    expect(res.status).toBe(403);
  });

  test("cascade : un team_owner crée une sous-équipe sous son équipe (201)", async () => {
    // Lucas est team_owner de dev → team:CREATE couvre dev par cascade.
    const res = await api("/teams", member, {
      method: "POST",
      body: json({ name: "Dev - Mobile", parent_team_id: fixtures.teams.dev }),
    });
    expect(res.status).toBe(201);
  });

  test("parent inexistant (404)", async () => {
    const res = await api("/teams", owner, {
      method: "POST",
      body: json({ name: "Orpheline", parent_team_id: 999999 }),
    });
    expect(res.status).toBe(404);
  });

  test("nom manquant (400)", async () => {
    const res = await api("/teams", owner, { method: "POST", body: json({}) });
    expect(res.status).toBe(400);
  });
});

describe("GET /teams/:id", () => {
  test("détail + membres pour un manager (200)", async () => {
    const res = await api(`/teams/${fixtures.teams.root}`, owner);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { members: unknown[] };
    expect(Array.isArray(body.members)).toBe(true);
  });

  test("équipe inexistante (404)", async () => {
    const res = await api("/teams/999999", owner);
    expect(res.status).toBe(404);
  });

  test("un membre ne peut pas voir une équipe hors de son périmètre (403)", async () => {
    const hidden = await createTeam("Confidentiel");
    const res = await api(`/teams/${hidden}`, member);
    expect(res.status).toBe(403);
  });
});

describe("PATCH /teams/:id", () => {
  test("un manager renomme une équipe (200)", async () => {
    const id = await createTeam("À renommer");
    const res = await api(`/teams/${id}`, owner, {
      method: "PATCH",
      body: json({ name: "Renommée" }),
    });
    expect(res.status).toBe(200);
  });

  test("un membre simple ne peut pas renommer (403)", async () => {
    const res = await api(`/teams/${fixtures.teams.root}`, member, {
      method: "PATCH",
      body: json({ name: "Piratée" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /teams/:id", () => {
  test("un manager supprime une équipe (204)", async () => {
    const id = await createTeam("À supprimer");
    const res = await api(`/teams/${id}`, owner, { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  test("un membre simple ne peut pas supprimer (403)", async () => {
    const res = await api(`/teams/${fixtures.teams.root}`, member, {
      method: "DELETE",
    });
    expect(res.status).toBe(403);
  });
});

describe("membres d'équipe", () => {
  test("un manager ajoute un membre de l'org (201)", async () => {
    const id = await createTeam("Recrutement");
    const res = await api(`/teams/${id}/members`, owner, {
      method: "POST",
      body: json({ userId: fixtures.users.pending.id }),
    });
    expect(res.status).toBe(201);
  });

  test("ajout en double refusé (409)", async () => {
    const id = await createTeam("Recrutement 2");
    await api(`/teams/${id}/members`, owner, {
      method: "POST",
      body: json({ userId: fixtures.users.lucas.id }),
    });
    const dup = await api(`/teams/${id}/members`, owner, {
      method: "POST",
      body: json({ userId: fixtures.users.lucas.id }),
    });
    expect(dup.status).toBe(409);
  });

  test("recrutement borné au sous-arbre : un team_owner ne peut pas ajouter hors périmètre (403)", async () => {
    // Lucas gère dev, mais julie n'est pas dans son sous-arbre.
    const res = await api(`/teams/${fixtures.teams.dev}/members`, member, {
      method: "POST",
      body: json({ userId: fixtures.users.julie.id }),
    });
    expect(res.status).toBe(403);
  });

  test("changement de rôle par un manager (200)", async () => {
    const id = await createTeam("Rôles");
    await api(`/teams/${id}/members`, owner, {
      method: "POST",
      body: json({ userId: fixtures.users.lucas.id }),
    });
    const res = await api(`/teams/${id}/members/${fixtures.users.lucas.id}`, owner, {
      method: "PATCH",
      body: json({ role: "team_admin" }),
    });
    expect(res.status).toBe(200);
  });

  test("rôle invalide (400)", async () => {
    const id = await createTeam("Rôles 2");
    await api(`/teams/${id}/members`, owner, {
      method: "POST",
      body: json({ userId: fixtures.users.lucas.id }),
    });
    const res = await api(`/teams/${id}/members/${fixtures.users.lucas.id}`, owner, {
      method: "PATCH",
      body: json({ role: "chef_supreme" }),
    });
    expect(res.status).toBe(400);
  });

  test("un membre peut se retirer lui-même (204)", async () => {
    const id = await createTeam("Départ");
    await api(`/teams/${id}/members`, owner, {
      method: "POST",
      body: json({ userId: fixtures.users.lucas.id }),
    });
    const res = await api(`/teams/${id}/members/${fixtures.users.lucas.id}`, member, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
  });

  test("retirer un membre inexistant (404)", async () => {
    const id = await createTeam("Vide");
    const res = await api(`/teams/${id}/members/${fixtures.users.pending.id}`, owner, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});
