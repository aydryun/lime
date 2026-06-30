import { apiUrl } from "./api";
import { authInit, jsonInit } from "./http";

export type CanalRole =
  | "canal_owner"
  | "canal_admin"
  | "canal_member"
  | "canal_reader";

export type Channel = {
  id: number;
  name: string;
  my_role: CanalRole;
};

export type ChannelMember = {
  user_id: number;
  username: string;
  firstname: string;
  lastname: string;
  role: CanalRole;
};

export type UserSummary = {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
};

export type ChannelMessage = {
  id: number;
  channel_id: number;
  user_id: number;
  sender: string;
  content: string;
  created_at: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    let code: string | null = null;
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      if (body?.error) message = body.error;
      if (body?.code) code = body.code;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(message, res.status, code);
  }
  return (await res.json()) as T;
}

export async function fetchChannels(): Promise<Channel[]> {
  return handle<Channel[]>(await fetch(apiUrl("/api/channels"), authInit()));
}

export async function createChannel(name: string): Promise<Channel> {
  return handle<Channel>(
    await fetch(apiUrl("/api/channels"), jsonInit("POST", { name })),
  );
}

export async function renameChannel(
  id: number,
  name: string,
): Promise<{ id: number; name: string }> {
  return handle<{ id: number; name: string }>(
    await fetch(apiUrl(`/api/channels/${id}`), jsonInit("PATCH", { name })),
  );
}

export async function deleteChannel(id: number): Promise<void> {
  await handle<unknown>(
    await fetch(apiUrl(`/api/channels/${id}`), authInit("DELETE")),
  );
}

export async function fetchMembers(
  channelId: number,
): Promise<ChannelMember[]> {
  return handle<ChannelMember[]>(
    await fetch(apiUrl(`/api/channels/${channelId}/members`), authInit()),
  );
}

export async function searchNonMembers(
  channelId: number,
  q: string,
): Promise<UserSummary[]> {
  const params = new URLSearchParams({ q });
  return handle<UserSummary[]>(
    await fetch(
      apiUrl(`/api/channels/${channelId}/non-members?${params.toString()}`),
      authInit(),
    ),
  );
}

export async function addMember(
  channelId: number,
  userId: number,
): Promise<void> {
  await handle<unknown>(
    await fetch(
      apiUrl(`/api/channels/${channelId}/members`),
      jsonInit("POST", { userId }),
    ),
  );
}

export async function removeMember(
  channelId: number,
  userId: number,
): Promise<void> {
  await handle<unknown>(
    await fetch(
      apiUrl(`/api/channels/${channelId}/members/${userId}`),
      authInit("DELETE"),
    ),
  );
}

export async function setMemberRole(
  channelId: number,
  userId: number,
  role: "canal_admin" | "canal_member" | "canal_reader",
): Promise<void> {
  await handle<unknown>(
    await fetch(
      apiUrl(`/api/channels/${channelId}/members/${userId}`),
      jsonInit("PATCH", { role }),
    ),
  );
}

export async function transferOwnership(
  channelId: number,
  newOwnerId: number,
): Promise<void> {
  await handle<unknown>(
    await fetch(
      apiUrl(`/api/channels/${channelId}/transfer`),
      jsonInit("POST", { userId: newOwnerId }),
    ),
  );
}

export async function fetchMessages(
  channelId: number,
): Promise<ChannelMessage[]> {
  return handle<ChannelMessage[]>(
    await fetch(apiUrl(`/api/channels/${channelId}/messages`), authInit()),
  );
}

export async function sendMessage(
  channelId: number,
  content: string,
): Promise<ChannelMessage> {
  return handle<ChannelMessage>(
    await fetch(
      apiUrl(`/api/channels/${channelId}/messages`),
      jsonInit("POST", { content }),
    ),
  );
}
