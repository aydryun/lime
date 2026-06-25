"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getStoredUser } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import { fetchOrgMembers, type OrgMember } from "@/lib/organisations";
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  fetchTeam,
  fetchTeams,
  removeTeamMember,
  renameTeam,
  type Team,
  type TeamDetail,
  type TeamMember,
} from "@/lib/teams";
import { Badge, ErrorBanner, FieldLabel, SectionHeader, TextInput } from "./ui";

const TEAM_ROLE_LABELS: Record<string, string> = {
  team_owner: "Propriétaire",
  team_admin: "Admin",
  team_member: "Membre",
};

export function TeamsSection() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const currentUserId = getStoredUser()?.id ?? null;
  const myOrgRole =
    orgMembers.find((m) => m.id === currentUserId)?.role ?? null;
  const isOrgManager = myOrgRole === "org_owner" || myOrgRole === "org_admin";

  const reloadTeams = async () => {
    try {
      setTeams(await fetchTeams());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur de chargement");
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [t, m] = await Promise.all([fetchTeams(), fetchOrgMembers()]);
        setTeams(t);
        setOrgMembers(m);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <SectionHeader
        title="Équipes"
        description="Créez des équipes et gérez leurs membres."
      />
      {error && (
        <div className="mb-6">
          <ErrorBanner message={error} />
        </div>
      )}

      <CreateTeamForm onCreated={reloadTeams} setError={setError} />

      <div className="divide-y divide-border rounded-lg border border-border bg-card mt-4">
        {loading && (
          <p className="text-sm text-muted-foreground p-4">Chargement…</p>
        )}
        {!loading && teams.length === 0 && (
          <p className="text-sm text-muted-foreground p-4">
            Aucune équipe pour le moment.
          </p>
        )}
        {teams.map((team) => (
          <TeamRow
            key={team.id}
            team={team}
            expanded={expandedId === team.id}
            onToggle={() =>
              setExpandedId((id) => (id === team.id ? null : team.id))
            }
            isOrgManager={isOrgManager}
            currentUserId={currentUserId}
            orgMembers={orgMembers}
            onChanged={reloadTeams}
            setError={setError}
          />
        ))}
      </div>
    </>
  );
}

function CreateTeamForm({
  onCreated,
  setError,
}: {
  onCreated: () => void;
  setError: (msg: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createTeam(name.trim());
      setName("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de création");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div className="space-y-2 flex-1">
        <FieldLabel htmlFor="new-team">Nouvelle équipe</FieldLabel>
        <TextInput
          id="new-team"
          value={name}
          placeholder="Nom de l'équipe"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={busy || !name.trim()}>
        {busy ? "Création..." : "Créer"}
      </Button>
    </form>
  );
}

function TeamRow({
  team,
  expanded,
  onToggle,
  isOrgManager,
  currentUserId,
  orgMembers,
  onChanged,
  setError,
}: {
  team: Team;
  expanded: boolean;
  onToggle: () => void;
  isOrgManager: boolean;
  currentUserId: number | null;
  orgMembers: OrgMember[];
  onChanged: () => void;
  setError: (msg: string | null) => void;
}) {
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(team.name);
  const [busy, setBusy] = useState(false);

  const loadDetail = async () => {
    try {
      setDetail(await fetchTeam(team.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur de chargement");
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: charge le détail à l'ouverture uniquement
  useEffect(() => {
    if (expanded && !detail) loadDetail();
  }, [expanded]);

  const myTeamRole =
    detail?.members.find((m) => m.user_id === currentUserId)?.role ?? null;
  const canManage =
    isOrgManager || myTeamRole === "team_owner" || myTeamRole === "team_admin";

  const refresh = async () => {
    await loadDetail();
    onChanged();
  };

  const handleRename = async () => {
    if (!name.trim() || name.trim() === team.name) {
      setRenaming(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await renameTeam(team.id, name.trim());
      setRenaming(false);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de renommage");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteTeam(team.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de suppression");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-5 py-3">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 text-left min-w-0"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm font-medium truncate">{team.name}</span>
          <Badge>
            {team.member_count} membre{team.member_count > 1 ? "s" : ""}
          </Badge>
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pl-6 space-y-4">
          {canManage && (
            <div className="flex items-center gap-2">
              {renaming ? (
                <>
                  <TextInput
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="max-w-xs"
                  />
                  <Button size="sm" disabled={busy} onClick={handleRename}>
                    Enregistrer
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setName(team.name);
                      setRenaming(false);
                    }}
                  >
                    Annuler
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRenaming(true)}
                  >
                    Renommer
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={handleDelete}
                  >
                    Supprimer l'équipe
                  </Button>
                </>
              )}
            </div>
          )}

          <div className="space-y-1">
            {detail?.members.map((m) => (
              <TeamMemberRow
                key={m.user_id}
                teamId={team.id}
                member={m}
                canManage={canManage}
                isSelf={m.user_id === currentUserId}
                onChanged={refresh}
                setError={setError}
              />
            ))}
            {detail && detail.members.length === 0 && (
              <p className="text-xs text-muted-foreground">Aucun membre.</p>
            )}
          </div>

          {canManage && detail && (
            <AddTeamMember
              teamId={team.id}
              orgMembers={orgMembers}
              existingIds={detail.members.map((m) => m.user_id)}
              onAdded={refresh}
              setError={setError}
            />
          )}
        </div>
      )}
    </div>
  );
}

function TeamMemberRow({
  teamId,
  member,
  canManage,
  isSelf,
  onChanged,
  setError,
}: {
  teamId: number;
  member: TeamMember;
  canManage: boolean;
  isSelf: boolean;
  onChanged: () => void;
  setError: (msg: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await removeTeamMember(teamId, member.user_id);
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Erreur lors du retrait",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="text-sm min-w-0 truncate">
        {member.firstname} {member.lastname}{" "}
        <span className="text-muted-foreground">@{member.username}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge tone={member.role === "team_owner" ? "primary" : "muted"}>
          {TEAM_ROLE_LABELS[member.role]}
        </Badge>
        {(canManage || isSelf) && member.role !== "team_owner" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={remove}
          >
            Retirer
          </Button>
        )}
      </div>
    </div>
  );
}

function AddTeamMember({
  teamId,
  orgMembers,
  existingIds,
  onAdded,
  setError,
}: {
  teamId: number;
  orgMembers: OrgMember[];
  existingIds: number[];
  onAdded: () => void;
  setError: (msg: string | null) => void;
}) {
  const candidates = orgMembers.filter((m) => !existingIds.includes(m.id));
  const [userId, setUserId] = useState<string>("");
  const [role, setRole] = useState<"team_member" | "team_admin">("team_member");
  const [busy, setBusy] = useState(false);

  if (candidates.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Tous les membres de l'organisation font déjà partie de l'équipe.
      </p>
    );
  }

  const handleAdd = async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      await addTeamMember(teamId, Number(userId), role);
      setUserId("");
      setRole("team_member");
      onAdded();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Erreur lors de l'ajout",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 pt-2 border-t border-border">
      <select
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="h-9 flex-1 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="">Ajouter un membre…</option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.firstname} {c.lastname} (@{c.username})
          </option>
        ))}
      </select>
      <select
        value={role}
        onChange={(e) =>
          setRole(e.target.value as "team_member" | "team_admin")
        }
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="team_member">Membre</option>
        <option value="team_admin">Admin</option>
      </select>
      <Button size="sm" disabled={busy || !userId} onClick={handleAdd}>
        Ajouter
      </Button>
    </div>
  );
}
