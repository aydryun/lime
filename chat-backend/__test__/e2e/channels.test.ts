import { beforeAll, describe, expect, test } from "bun:test";
import { api, as, fixtures, json } from "./helpers.js";

// Rôles canal semés :
//   général (org-wide) : admin=owner, julie/lucas=member par défaut
//   random (lié équipe) : julie=owner, lucas=reader, admin=member
//   dev    (sous-arbre) : lucas=owner, julie=admin, admin=member
let adminTok = ""; // org_owner + canal_owner de général
let julieTok = ""; // org_admin + canal_owner de random
let lucasTok = ""; // member + canal_owner de dev + reader de random

beforeAll(async () => {
  adminTok = await as.owner();
  julieTok = await as.admin();
  lucasTok = await as.member();
});

let seq = 0;
/** Crée un canal privé (le créateur est canal_owner) et renvoie son id. */
async function createPrivate(token: string): Promise<number> {
  seq += 1;
  const res = await api("/channels", token, {
    method: "POST",
    body: json({ name: `canal-test-${seq}` }),
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: number }).id;
}

describe("GET /channels", () => {
  test("liste les canaux de l'utilisateur (200)", async () => {
    const res = await api("/channels", adminTok);
    expect(res.status).toBe(200);
    const ids = ((await res.json()) as Array<{ id: number }>).map((c) => c.id);
    expect(ids).toContain(fixtures.channels.general);
  });

  test("sans authentification (401)", async () => {
    const res = await api("/channels", "");
    expect(res.status).toBe(401);
  });
});

describe("POST /channels", () => {
  test("tout membre crée un canal privé (201)", async () => {
    const res = await api("/channels", lucasTok, {
      method: "POST",
      body: json({ name: "mon-canal-privé", mode: "private" }),
    });
    expect(res.status).toBe(201);
    expect(((await res.json()) as { my_role: string }).my_role).toBe("canal_owner");
  });

  test("un membre simple ne peut pas créer de canal org-wide (403)", async () => {
    const res = await api("/channels", lucasTok, {
      method: "POST",
      body: json({ name: "org-wide-illégal", mode: "org" }),
    });
    expect(res.status).toBe(403);
  });

  test("un manager d'org crée un canal org-wide (201)", async () => {
    const res = await api("/channels", adminTok, {
      method: "POST",
      body: json({ name: "annonces", mode: "org" }),
    });
    expect(res.status).toBe(201);
  });

  test("cascade : un team_owner crée un canal scopé à son équipe (201)", async () => {
    // Lucas est team_owner de dev → channel:CREATE couvre dev.
    const res = await api("/channels", lucasTok, {
      method: "POST",
      body: json({ name: "canal-dev", mode: "team", team_id: fixtures.teams.dev }),
    });
    expect(res.status).toBe(201);
  });

  test("mode d'ajout inconnu (400)", async () => {
    const res = await api("/channels", adminTok, {
      method: "POST",
      body: json({ name: "bizarre", mode: "wat" }),
    });
    expect(res.status).toBe(400);
  });

  test("nom manquant (400)", async () => {
    const res = await api("/channels", adminTok, {
      method: "POST",
      body: json({ mode: "private" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /channels/:id", () => {
  test("le propriétaire renomme son canal (200)", async () => {
    const id = await createPrivate(lucasTok);
    const res = await api(`/channels/${id}`, lucasTok, {
      method: "PATCH",
      body: json({ name: "renommé" }),
    });
    expect(res.status).toBe(200);
  });

  test("un non-propriétaire ne peut pas renommer (403)", async () => {
    const id = await createPrivate(lucasTok);
    const res = await api(`/channels/${id}`, julieTok, {
      method: "PATCH",
      body: json({ name: "pirate" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /channels/:id", () => {
  test("le propriétaire supprime son canal (200)", async () => {
    const id = await createPrivate(lucasTok);
    const res = await api(`/channels/${id}`, lucasTok, { method: "DELETE" });
    expect(res.status).toBe(200);
  });

  test("un non-membre ne peut pas supprimer (403)", async () => {
    const id = await createPrivate(lucasTok);
    const res = await api(`/channels/${id}`, julieTok, { method: "DELETE" });
    expect(res.status).toBe(403);
  });
});

describe("membres du canal", () => {
  test("GET members pour un membre du canal (200)", async () => {
    const res = await api(`/channels/${fixtures.channels.general}/members`, adminTok);
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test("GET members refusé à un non-membre (403)", async () => {
    const id = await createPrivate(lucasTok);
    const res = await api(`/channels/${id}/members`, julieTok);
    expect(res.status).toBe(403);
  });

  test("GET non-members réservé owner/admin (403 pour un simple membre)", async () => {
    // Julie est canal_member de général.
    const res = await api(
      `/channels/${fixtures.channels.general}/non-members`,
      julieTok,
    );
    expect(res.status).toBe(403);
  });

  test("le propriétaire ajoute un membre (201) puis idempotent (200)", async () => {
    const id = await createPrivate(lucasTok);
    const first = await api(`/channels/${id}/members`, lucasTok, {
      method: "POST",
      body: json({ userId: fixtures.users.julie.id }),
    });
    expect(first.status).toBe(201);
    const again = await api(`/channels/${id}/members`, lucasTok, {
      method: "POST",
      body: json({ userId: fixtures.users.julie.id }),
    });
    expect(again.status).toBe(200);
  });

  test("userId manquant à l'ajout (400)", async () => {
    const id = await createPrivate(lucasTok);
    const res = await api(`/channels/${id}/members`, lucasTok, {
      method: "POST",
      body: json({}),
    });
    expect(res.status).toBe(400);
  });

  test("changement de rôle par le propriétaire (200)", async () => {
    const id = await createPrivate(lucasTok);
    await api(`/channels/${id}/members`, lucasTok, {
      method: "POST",
      body: json({ userId: fixtures.users.julie.id }),
    });
    const res = await api(`/channels/${id}/members/${fixtures.users.julie.id}`, lucasTok, {
      method: "PATCH",
      body: json({ role: "canal_admin" }),
    });
    expect(res.status).toBe(200);
  });

  test("on ne peut pas changer le rôle du propriétaire (409)", async () => {
    const id = await createPrivate(lucasTok);
    const res = await api(`/channels/${id}/members/${fixtures.users.lucas.id}`, lucasTok, {
      method: "PATCH",
      body: json({ role: "canal_admin" }),
    });
    expect(res.status).toBe(409);
  });

  test("rôle invalide (400)", async () => {
    const id = await createPrivate(lucasTok);
    await api(`/channels/${id}/members`, lucasTok, {
      method: "POST",
      body: json({ userId: fixtures.users.julie.id }),
    });
    const res = await api(`/channels/${id}/members/${fixtures.users.julie.id}`, lucasTok, {
      method: "PATCH",
      body: json({ role: "canal_god" }),
    });
    expect(res.status).toBe(400);
  });

  test("le propriétaire retire un membre (200)", async () => {
    const id = await createPrivate(lucasTok);
    await api(`/channels/${id}/members`, lucasTok, {
      method: "POST",
      body: json({ userId: fixtures.users.julie.id }),
    });
    const res = await api(`/channels/${id}/members/${fixtures.users.julie.id}`, lucasTok, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
  });

  test("retirer un non-membre (404)", async () => {
    const id = await createPrivate(lucasTok);
    const res = await api(`/channels/${id}/members/${fixtures.users.julie.id}`, lucasTok, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  test("un propriétaire ne peut pas partir s'il reste des membres (409)", async () => {
    const id = await createPrivate(lucasTok);
    await api(`/channels/${id}/members`, lucasTok, {
      method: "POST",
      body: json({ userId: fixtures.users.julie.id }),
    });
    const res = await api(`/channels/${id}/members/${fixtures.users.lucas.id}`, lucasTok, {
      method: "DELETE",
    });
    expect(res.status).toBe(409);
  });

  test("un propriétaire seul qui part supprime le canal (200)", async () => {
    const id = await createPrivate(lucasTok);
    const res = await api(`/channels/${id}/members/${fixtures.users.lucas.id}`, lucasTok, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
  });
});

describe("POST /channels/:id/transfer", () => {
  test("le propriétaire transfère la propriété (200)", async () => {
    const id = await createPrivate(lucasTok);
    await api(`/channels/${id}/members`, lucasTok, {
      method: "POST",
      body: json({ userId: fixtures.users.julie.id }),
    });
    const res = await api(`/channels/${id}/transfer`, lucasTok, {
      method: "POST",
      body: json({ userId: fixtures.users.julie.id }),
    });
    expect(res.status).toBe(200);
  });

  test("transfert vers un non-membre (404)", async () => {
    const id = await createPrivate(lucasTok);
    const res = await api(`/channels/${id}/transfer`, lucasTok, {
      method: "POST",
      body: json({ userId: fixtures.users.julie.id }),
    });
    expect(res.status).toBe(404);
  });

  test("transfert vers soi-même invalide (400)", async () => {
    const id = await createPrivate(lucasTok);
    const res = await api(`/channels/${id}/transfer`, lucasTok, {
      method: "POST",
      body: json({ userId: fixtures.users.lucas.id }),
    });
    expect(res.status).toBe(400);
  });

  test("un non-propriétaire ne peut pas transférer (403)", async () => {
    const id = await createPrivate(lucasTok);
    const res = await api(`/channels/${id}/transfer`, julieTok, {
      method: "POST",
      body: json({ userId: fixtures.users.admin.id }),
    });
    expect(res.status).toBe(403);
  });
});

describe("messages", () => {
  test("un membre lit les messages (200)", async () => {
    const res = await api(`/channels/${fixtures.channels.general}/messages`, adminTok);
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test("un non-membre ne peut pas lire (403)", async () => {
    const id = await createPrivate(lucasTok);
    const res = await api(`/channels/${id}/messages`, julieTok);
    expect(res.status).toBe(403);
  });

  test("un membre poste un message (201)", async () => {
    const res = await api(`/channels/${fixtures.channels.general}/messages`, lucasTok, {
      method: "POST",
      body: json({ content: "Bonjour depuis les tests" }),
    });
    expect(res.status).toBe(201);
  });

  test("un lecteur seule ne peut pas écrire (403)", async () => {
    // Lucas est canal_reader de random.
    const res = await api(`/channels/${fixtures.channels.random}/messages`, lucasTok, {
      method: "POST",
      body: json({ content: "je ne devrais pas pouvoir" }),
    });
    expect(res.status).toBe(403);
  });

  test("contenu vide (400)", async () => {
    const res = await api(`/channels/${fixtures.channels.general}/messages`, lucasTok, {
      method: "POST",
      body: json({ content: "   " }),
    });
    expect(res.status).toBe(400);
  });

  test("message trop long (400)", async () => {
    const res = await api(`/channels/${fixtures.channels.general}/messages`, lucasTok, {
      method: "POST",
      body: json({ content: "x".repeat(4001) }),
    });
    expect(res.status).toBe(400);
  });
});
