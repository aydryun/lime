import { beforeAll, describe, expect, test } from "bun:test";
import { api, as, fixtures, json } from "./helpers.js";

// admin = org_owner, julie = org_admin, lucas = member simple.
let owner = "";
let admin = "";
let member = "";

beforeAll(async () => {
  owner = await as.owner();
  admin = await as.admin();
  member = await as.member();
});

let memberSeq = 0;
/** Crée un membre d'org (non activé) via l'API et renvoie son id. */
async function createMember(): Promise<number> {
  memberSeq += 1;
  const res = await api("/org/members", owner, {
    method: "POST",
    body: json({
      firstname: "Temp",
      lastname: "Member",
      email: `temp${memberSeq}@org.test`,
      username: `temp${memberSeq}`,
    }),
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: number }).id;
}

describe("GET /org", () => {
  test("infos de l'org pour tout membre authentifié (200)", async () => {
    const res = await api("/org", member);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: number };
    expect(body.id).toBe(fixtures.org.id);
  });

  test("sans authentification (401)", async () => {
    const res = await api("/org", "");
    expect(res.status).toBe(401);
  });
});

describe("PATCH /org", () => {
  test("un manager met à jour le nom (200)", async () => {
    const res = await api("/org", owner, {
      method: "PATCH",
      body: json({ nom: "Organisation Lime SAS" }),
    });
    expect(res.status).toBe(200);
  });

  test("un membre simple ne peut pas modifier (403)", async () => {
    const res = await api("/org", member, {
      method: "PATCH",
      body: json({ nom: "Piratée" }),
    });
    expect(res.status).toBe(403);
  });

  test("SIREN invalide (400)", async () => {
    const res = await api("/org", owner, {
      method: "PATCH",
      body: json({ siren: "123" }),
    });
    expect(res.status).toBe(400);
  });

  test("SIRET invalide (400)", async () => {
    const res = await api("/org", owner, {
      method: "PATCH",
      body: json({ siret: "1234" }),
    });
    expect(res.status).toBe(400);
  });

  test("email de contact invalide (400)", async () => {
    const res = await api("/org", owner, {
      method: "PATCH",
      body: json({ email: "pas-un-email" }),
    });
    expect(res.status).toBe(400);
  });

  test("SIREN valide (9 chiffres) accepté (200)", async () => {
    const res = await api("/org", owner, {
      method: "PATCH",
      body: json({ siren: "123456789" }),
    });
    expect(res.status).toBe(200);
  });

  test("aucun champ à mettre à jour (400)", async () => {
    const res = await api("/org", owner, { method: "PATCH", body: json({}) });
    expect(res.status).toBe(400);
  });

  test("le nom ne peut pas être vidé (400)", async () => {
    const res = await api("/org", owner, {
      method: "PATCH",
      body: json({ nom: "" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /org/members", () => {
  test("liste des membres pour tout membre authentifié (200)", async () => {
    const res = await api("/org/members", member);
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });
});

describe("POST /org/members", () => {
  test("un manager crée un membre (201)", async () => {
    const res = await api("/org/members", owner, {
      method: "POST",
      body: json({
        firstname: "Nadia",
        lastname: "Nouvelle",
        email: "nadia@org.test",
        username: "nadia",
      }),
    });
    expect(res.status).toBe(201);
  });

  test("un membre simple ne peut pas inviter (403)", async () => {
    const res = await api("/org/members", member, {
      method: "POST",
      body: json({
        firstname: "X",
        lastname: "Y",
        email: "x@org.test",
        username: "xy",
      }),
    });
    expect(res.status).toBe(403);
  });

  test("email invalide (400)", async () => {
    const res = await api("/org/members", owner, {
      method: "POST",
      body: json({
        firstname: "Bad",
        lastname: "Mail",
        email: "pas-un-email",
        username: "badmail",
      }),
    });
    expect(res.status).toBe(400);
  });

  test("champs manquants (400)", async () => {
    const res = await api("/org/members", owner, {
      method: "POST",
      body: json({ email: "incomplet@org.test" }),
    });
    expect(res.status).toBe(400);
  });

  test("email déjà utilisé (409)", async () => {
    const res = await api("/org/members", owner, {
      method: "POST",
      body: json({
        firstname: "Dup",
        lastname: "Licate",
        email: fixtures.users.julie.email,
        username: "dupjulie2",
      }),
    });
    expect(res.status).toBe(409);
  });
});

describe("PATCH /org/members/:userId", () => {
  test("un manager change le rôle d'un membre (200)", async () => {
    const id = await createMember();
    const res = await api(`/org/members/${id}`, owner, {
      method: "PATCH",
      body: json({ role: "org_admin" }),
    });
    expect(res.status).toBe(200);
  });

  test("rôle invalide (400)", async () => {
    const id = await createMember();
    const res = await api(`/org/members/${id}`, owner, {
      method: "PATCH",
      body: json({ role: "super_boss" }),
    });
    expect(res.status).toBe(400);
  });

  test("le rôle du propriétaire ne peut pas être changé (403)", async () => {
    const res = await api(`/org/members/${fixtures.users.admin.id}`, owner, {
      method: "PATCH",
      body: json({ role: "member" }),
    });
    expect(res.status).toBe(403);
  });

  test("un membre simple ne peut pas changer de rôle (403)", async () => {
    const id = await createMember();
    const res = await api(`/org/members/${id}`, member, {
      method: "PATCH",
      body: json({ role: "org_admin" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /org/members/:userId", () => {
  test("on ne peut pas se retirer soi-même (400)", async () => {
    const res = await api(`/org/members/${fixtures.users.admin.id}`, owner, {
      method: "DELETE",
    });
    expect(res.status).toBe(400);
  });

  test("le propriétaire ne peut pas être retiré (403)", async () => {
    const res = await api(`/org/members/${fixtures.users.admin.id}`, admin, {
      method: "DELETE",
    });
    expect(res.status).toBe(403);
  });

  test("un membre avec du contenu ne peut pas être retiré (409)", async () => {
    // Lucas a des messages semés → suppression bloquée (et rollback : il reste).
    const res = await api(`/org/members/${fixtures.users.lucas.id}`, owner, {
      method: "DELETE",
    });
    expect(res.status).toBe(409);
  });

  test("un membre simple ne peut pas retirer un membre (403)", async () => {
    const id = await createMember();
    const res = await api(`/org/members/${id}`, member, { method: "DELETE" });
    expect(res.status).toBe(403);
  });

  test("un manager retire un membre sans contenu (204)", async () => {
    const id = await createMember();
    const res = await api(`/org/members/${id}`, owner, { method: "DELETE" });
    expect(res.status).toBe(204);
  });
});
