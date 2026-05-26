"use client";

import { ArrowDown, ArrowUp, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  addMember,
  type CanalRole,
  type ChannelMember,
  fetchMembers,
  removeMember,
  searchNonMembers,
  setMemberRole,
  type UserSummary,
} from "@/lib/channels";

type Props = {
  channelId: number;
  channelName: string;
  currentUserId: number | null;
  callerRole: CanalRole;
  onClose: () => void;
};

const ROLE_LABEL: Record<CanalRole, string> = {
  canal_owner: "Propriétaire",
  canal_admin: "Admin",
  canal_member: "Membre",
};

export function ChannelMembersDialog({
  channelId,
  channelName,
  currentUserId,
  callerRole,
  onClose,
}: Props) {
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canAdd = callerRole !== "canal_member";

  useEffect(() => {
    let cancelled = false;
    fetchMembers(channelId)
      .then((m) => {
        if (!cancelled) setMembers(m);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  useEffect(() => {
    if (!canAdd) return;
    const handle = setTimeout(() => {
      searchNonMembers(channelId, query)
        .then((users) => setCandidates(users))
        .catch(() => setCandidates([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [channelId, query, canAdd]);

  const handleAdd = async (user: UserSummary) => {
    try {
      await addMember(channelId, user.id);
      setMembers((prev) => [
        ...prev,
        {
          user_id: user.id,
          username: user.username,
          firstname: user.firstname,
          lastname: user.lastname,
          role: "canal_member",
        },
      ]);
      setCandidates((prev) => prev.filter((u) => u.id !== user.id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleRemove = async (userId: number) => {
    try {
      await removeMember(channelId, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSetRole = async (
    userId: number,
    role: "canal_admin" | "canal_member",
  ) => {
    try {
      await setMemberRole(channelId, userId, role);
      setMembers((prev) =>
        prev.map((m) => (m.user_id === userId ? { ...m, role } : m)),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const canActOn = (member: ChannelMember) => {
    if (member.user_id === currentUserId) return false;
    if (member.role === "canal_owner") return false;
    if (callerRole === "canal_owner") return true;
    if (callerRole === "canal_admin" && member.role === "canal_member")
      return true;
    return false;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Membres du canal ${channelName}`}
    >
      <div
        className="bg-background border border-border rounded-lg shadow-lg w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold">Membres — #{channelName}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="px-4 py-2 text-sm text-destructive border-b border-border">
            {error}
          </div>
        )}

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          <div>
            <div className="text-xs uppercase text-muted-foreground mb-2">
              Membres ({members.length})
            </div>
            {loading ? (
              <div className="text-sm text-muted-foreground">Chargement…</div>
            ) : (
              <ul className="space-y-1">
                {members.map((m) => {
                  const actionable = canActOn(m);
                  return (
                    <li
                      key={m.user_id}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {m.firstname} {m.lastname}{" "}
                          <span className="text-muted-foreground font-normal">
                            @{m.username}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {ROLE_LABEL[m.role]}
                          {m.user_id === currentUserId && " (vous)"}
                        </div>
                      </div>
                      {actionable && (
                        <div className="flex items-center gap-1">
                          {callerRole === "canal_owner" &&
                            m.role === "canal_member" && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleSetRole(m.user_id, "canal_admin")
                                }
                                title="Promouvoir admin"
                                aria-label={`Promouvoir ${m.username} admin`}
                                className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                              >
                                <ArrowUp className="w-4 h-4" />
                              </button>
                            )}
                          {callerRole === "canal_owner" &&
                            m.role === "canal_admin" && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleSetRole(m.user_id, "canal_member")
                                }
                                title="Rétrograder"
                                aria-label={`Rétrograder ${m.username}`}
                                className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                              >
                                <ArrowDown className="w-4 h-4" />
                              </button>
                            )}
                          <button
                            type="button"
                            onClick={() => handleRemove(m.user_id)}
                            className="text-xs px-2 py-1 rounded-md text-destructive hover:bg-destructive/10"
                          >
                            Retirer
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {canAdd && (
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-2">
                Ajouter un membre
              </div>
              <input
                type="text"
                placeholder="Rechercher un utilisateur…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <ul className="mt-2 space-y-1">
                {candidates.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50"
                  >
                    <div className="text-sm truncate">
                      {u.firstname} {u.lastname}{" "}
                      <span className="text-muted-foreground">
                        @{u.username}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdd(u)}
                      aria-label={`Ajouter ${u.username}`}
                      className="p-1 rounded-md text-primary hover:bg-primary/10"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                  </li>
                ))}
                {!candidates.length && query && (
                  <li className="text-sm text-muted-foreground px-2">
                    Aucun utilisateur trouvé.
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
