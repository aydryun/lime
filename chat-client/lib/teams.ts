import { apiUrl } from "./api";
import { getJson, handle, jsonInit } from "./http";

export type TeamRole = "team_owner" | "team_admin" | "team_member";

export type Team = {
  id: number;
  name: string;
  org_id: number;
  member_count: number;
};

export type TeamMember = {
  user_id: number;
  username: string;
  firstname: string;
  lastname: string;
  role: TeamRole;
};

export type TeamDetail = {
  id: number;
  name: string;
  org_id: number;
  members: TeamMember[];
};

export async function fetchTeams(): Promise<Team[]> {
  return getJson<Team[]>("/api/teams");
}

export async function fetchTeam(id: number): Promise<TeamDetail> {
  return getJson<TeamDetail>(`/api/teams/${id}`);
}

export async function createTeam(name: string): Promise<Team> {
  return handle<Team>(
    await fetch(apiUrl("/api/teams"), jsonInit("POST", { name })),
  );
}

export async function renameTeam(
  id: number,
  name: string,
): Promise<{ id: number; name: string; org_id: number }> {
  return handle<{ id: number; name: string; org_id: number }>(
    await fetch(apiUrl(`/api/teams/${id}`), jsonInit("PATCH", { name })),
  );
}

export async function deleteTeam(id: number): Promise<void> {
  await handle<void>(
    await fetch(apiUrl(`/api/teams/${id}`), {
      method: "DELETE",
      credentials: "include",
    }),
  );
}

export async function fetchTeamMembers(id: number): Promise<TeamMember[]> {
  return getJson<TeamMember[]>(`/api/teams/${id}/members`);
}

export async function addTeamMember(
  teamId: number,
  userId: number,
  role?: "team_admin" | "team_member",
): Promise<{ team_id: number; user_id: number; role: TeamRole }> {
  return handle<{ team_id: number; user_id: number; role: TeamRole }>(
    await fetch(
      apiUrl(`/api/teams/${teamId}/members`),
      jsonInit("POST", { userId, role }),
    ),
  );
}

export async function removeTeamMember(
  teamId: number,
  userId: number,
): Promise<void> {
  await handle<void>(
    await fetch(apiUrl(`/api/teams/${teamId}/members/${userId}`), {
      method: "DELETE",
      credentials: "include",
    }),
  );
}
