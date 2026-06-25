import { apiUrl } from "./api";
import { getJson, handle, jsonInit } from "./http";

export type OrgRole = "org_owner" | "org_admin" | "member";

export type Organisation = {
  id: number;
  nom: string;
  raison_sociale: string | null;
  siren: string | null;
  siret: string | null;
  tva_intracommunautaire: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  pays: string | null;
  created_at: string;
  updated_at: string;
};

/** Champs modifiables de l'org (alignés sur le backend). */
export type OrganisationUpdate = Partial<
  Pick<
    Organisation,
    | "nom"
    | "raison_sociale"
    | "siren"
    | "siret"
    | "tva_intracommunautaire"
    | "email"
    | "telephone"
    | "adresse"
    | "code_postal"
    | "ville"
    | "pays"
  >
>;

export type OrgMember = {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  username: string;
  role: OrgRole | null;
  activated: boolean;
};

export type InviteMemberInput = {
  firstname: string;
  lastname: string;
  username: string;
  email: string;
  role?: "org_admin" | "member";
};

export async function fetchOrganisation(): Promise<Organisation> {
  return getJson<Organisation>("/api/org");
}

export async function updateOrganisation(
  fields: OrganisationUpdate,
): Promise<Organisation> {
  return handle<Organisation>(
    await fetch(apiUrl("/api/org"), jsonInit("PATCH", fields)),
  );
}

export async function fetchOrgMembers(): Promise<OrgMember[]> {
  return getJson<OrgMember[]>("/api/org/members");
}

export async function inviteOrgMember(
  input: InviteMemberInput,
): Promise<OrgMember & { emailSent: boolean }> {
  return handle<OrgMember & { emailSent: boolean }>(
    await fetch(apiUrl("/api/org/members"), jsonInit("POST", input)),
  );
}

export async function setOrgMemberRole(
  userId: number,
  role: "org_admin" | "member",
): Promise<{ id: number; role: OrgRole }> {
  return handle<{ id: number; role: OrgRole }>(
    await fetch(
      apiUrl(`/api/org/members/${userId}`),
      jsonInit("PATCH", { role }),
    ),
  );
}

export async function removeOrgMember(userId: number): Promise<void> {
  await handle<void>(
    await fetch(apiUrl(`/api/org/members/${userId}`), {
      method: "DELETE",
      credentials: "include",
    }),
  );
}
