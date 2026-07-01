import { beforeAll, describe, expect, test } from "bun:test";
import { fetch } from "bun";
import jwt from "jsonwebtoken";
import { API_URL, as, fixtures, json } from "./helpers.js";

const JWT_SECRET = process.env.JWT_SECRET as string;

// admin = org_owner de Lime ; mallory = org_owner de Beta (tenant distinct).
let lime = "";
let beta = "";
let member = "";

beforeAll(async () => {
  lime = await as.owner();
  beta = await as.beta();
  member = await as.member();
});

/** Requête authentifiée par un token brut (pour tester le portail d'auth). */
function withToken(path: string, token: string): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe("portail d'authentification (middleware)", () => {
  test("aucun token (401)", async () => {
    const res = await fetch(`${API_URL}/org`);
    expect(res.status).toBe(401);
  });

  test("token illisible (401)", async () => {
    const res = await withToken("/org", "pas.un.jwt");
    expect(res.status).toBe(401);
  });

  test("token signé avec le mauvais secret (401)", async () => {
    const forged = jwt.sign(
      { userId: fixtures.users.admin.id, orgId: fixtures.org.id },
      "mauvais_secret",
    );
    const res = await withToken("/org", forged);
    expect(res.status).toBe(401);
  });

  test("token sans orgId refusé (401)", async () => {
    // Un token antérieur au multi-tenant (pas d'orgId) ne doit pas passer.
    const legacy = jwt.sign({ userId: fixtures.users.admin.id }, JWT_SECRET);
    const res = await withToken("/org", legacy);
    expect(res.status).toBe(401);
  });

  test("token expiré (401)", async () => {
    const expired = jwt.sign(
      { userId: fixtures.users.admin.id, orgId: fixtures.org.id },
      JWT_SECRET,
      { expiresIn: "-1s" },
    );
    const res = await withToken("/org", expired);
    expect(res.status).toBe(401);
  });
});

describe("isolation multi-tenant : Lime -> Beta", () => {
  test("une équipe d'un autre tenant est introuvable (404)", async () => {
    const res = await withToken(`/teams/${fixtures.beta.teams.root}`, lime);
    expect(res.status).toBe(404);
  });

  test("modifier une équipe d'un autre tenant (404)", async () => {
    const res = await fetch(`${API_URL}/teams/${fixtures.beta.teams.root}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${lime}`,
        "Content-Type": "application/json",
      },
      body: json({ name: "hijack" }),
    });
    expect(res.status).toBe(404);
  });

  test("les membres d'un canal d'un autre tenant sont inaccessibles (403)", async () => {
    const res = await withToken(
      `/channels/${fixtures.beta.channels.private}/members`,
      lime,
    );
    expect(res.status).toBe(403);
  });

  test("les messages d'un canal d'un autre tenant sont inaccessibles (403)", async () => {
    const res = await withToken(
      `/channels/${fixtures.beta.channels.private}/messages`,
      lime,
    );
    expect(res.status).toBe(403);
  });

  test("poster dans un canal d'un autre tenant (403)", async () => {
    const res = await fetch(
      `${API_URL}/channels/${fixtures.beta.channels.private}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lime}`,
          "Content-Type": "application/json",
        },
        body: json({ content: "intrusion" }),
      },
    );
    expect(res.status).toBe(403);
  });

  test("les ressources de Beta n'apparaissent pas dans les listes de Lime", async () => {
    const teams = (await (await withToken("/teams", lime)).json()) as Array<{
      id: number;
    }>;
    expect(teams.map((t) => t.id)).not.toContain(fixtures.beta.teams.root);
    const channels = (await (
      await withToken("/channels", lime)
    ).json()) as Array<{ id: number }>;
    expect(channels.map((c) => c.id)).not.toContain(
      fixtures.beta.channels.private,
    );
  });
});

describe("isolation multi-tenant : Beta -> Lime", () => {
  test("Beta ne voit pas le canal général de Lime (403)", async () => {
    const res = await withToken(
      `/channels/${fixtures.channels.general}/messages`,
      beta,
    );
    expect(res.status).toBe(403);
  });

  test("Beta ne voit pas une équipe de Lime (404)", async () => {
    const res = await withToken(`/teams/${fixtures.teams.root}`, beta);
    expect(res.status).toBe(404);
  });

  test("les ressources de Lime n'apparaissent pas dans les listes de Beta", async () => {
    const teams = (await (await withToken("/teams", beta)).json()) as Array<{
      id: number;
    }>;
    expect(teams.map((t) => t.id)).not.toContain(fixtures.teams.root);
  });
});

describe("anti-escalade de privilèges", () => {
  test("un membre ne peut pas s'auto-promouvoir org_admin (403)", async () => {
    const res = await fetch(
      `${API_URL}/org/members/${fixtures.users.lucas.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${member}`,
          "Content-Type": "application/json",
        },
        body: json({ role: "org_admin" }),
      },
    );
    expect(res.status).toBe(403);
  });

  test("un membre ne peut pas modifier l'organisation (403)", async () => {
    const res = await fetch(`${API_URL}/org`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${member}`,
        "Content-Type": "application/json",
      },
      body: json({ nom: "Mainmise" }),
    });
    expect(res.status).toBe(403);
  });
});
