"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getStoredUser } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import {
  fetchOrganisation,
  fetchOrgMembers,
  inviteOrgMember,
  type Organisation,
  type OrganisationUpdate,
  type OrgMember,
  removeOrgMember,
  setOrgMemberRole,
  updateOrganisation,
} from "@/lib/organisations";
import { Badge, ErrorBanner, FieldLabel, SectionHeader, TextInput } from "./ui";

const ROLE_LABELS: Record<string, string> = {
  org_owner: "Propriétaire",
  org_admin: "Admin",
  member: "Membre",
};

/** Champs du formulaire d'infos entreprise (ordre d'affichage). */
const ORG_FIELDS: {
  key: keyof OrganisationUpdate;
  label: string;
  type?: string;
  placeholder?: string;
}[] = [
  { key: "nom", label: "Nom" },
  { key: "raison_sociale", label: "Raison sociale" },
  { key: "siren", label: "SIREN", placeholder: "9 chiffres" },
  { key: "siret", label: "SIRET", placeholder: "14 chiffres" },
  { key: "tva_intracommunautaire", label: "TVA intracommunautaire" },
  { key: "email", label: "Email de contact", type: "email" },
  { key: "telephone", label: "Téléphone" },
  { key: "adresse", label: "Adresse" },
  { key: "code_postal", label: "Code postal" },
  { key: "ville", label: "Ville" },
  { key: "pays", label: "Pays" },
];

export function OrganisationSection() {
  const [org, setOrg] = useState<Organisation | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentUserId = getStoredUser()?.id ?? null;

  const myRole = members.find((m) => m.id === currentUserId)?.role ?? null;
  const isManager = myRole === "org_owner" || myRole === "org_admin";

  const reloadMembers = async () => {
    try {
      setMembers(await fetchOrgMembers());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur de chargement");
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [o, m] = await Promise.all([
          fetchOrganisation(),
          fetchOrgMembers(),
        ]);
        setOrg(o);
        setMembers(m);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <>
        <SectionHeader
          title="Organisation"
          description="Informations de l'entreprise et gestion des membres."
        />
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </>
    );
  }

  return (
    <>
      <SectionHeader
        title="Organisation"
        description="Informations de l'entreprise et gestion des membres."
      />
      {error && (
        <div className="mb-6">
          <ErrorBanner message={error} />
        </div>
      )}

      {org && <OrgInfoForm org={org} canEdit={isManager} onSaved={setOrg} />}

      <div className="mt-10">
        <div className="mb-4">
          <h2 className="text-sm font-medium">Membres</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isManager
              ? "Invitez, promouvez ou retirez des membres."
              : "Membres de votre organisation."}
          </p>
        </div>

        {isManager && (
          <InviteMemberForm onInvited={reloadMembers} setError={setError} />
        )}

        <div className="divide-y divide-border rounded-lg border border-border bg-card mt-4">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              isSelf={m.id === currentUserId}
              canManage={isManager && m.role !== "org_owner"}
              onChanged={reloadMembers}
              setError={setError}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function OrgInfoForm({
  org,
  canEdit,
  onSaved,
}: {
  org: Organisation;
  canEdit: boolean;
  onSaved: (org: Organisation) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init: Record<string, string> = {};
    for (const { key } of ORG_FIELDS) init[key] = org[key] ?? "";
    setValues(init);
  }, [org]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    // On n'envoie que les champs modifiés ; "" efface (sauf nom géré côté backend).
    const fields: OrganisationUpdate = {};
    for (const { key } of ORG_FIELDS) {
      const next = values[key]?.trim() ?? "";
      const prev = org[key] ?? "";
      if (next !== prev) {
        (fields as Record<string, string>)[key] = next;
      }
    }
    if (Object.keys(fields).length === 0) {
      setStatus("idle");
      return;
    }
    try {
      const updated = await updateOrganisation(fields);
      onSaved(updated);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de mise à jour");
      setStatus("idle");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {ORG_FIELDS.map(({ key, label, type, placeholder }) => (
          <div className="space-y-2" key={key}>
            <FieldLabel htmlFor={`org-${key}`}>{label}</FieldLabel>
            <TextInput
              id={`org-${key}`}
              type={type ?? "text"}
              placeholder={placeholder}
              value={values[key] ?? ""}
              disabled={!canEdit}
              onChange={(e) =>
                setValues((v) => ({ ...v, [key]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>
      {error && <ErrorBanner message={error} />}
      {canEdit && (
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={status === "saving"}>
            {status === "saving" ? "Enregistrement..." : "Enregistrer"}
          </Button>
          {status === "saved" && (
            <span className="text-sm text-muted-foreground">
              Modifications enregistrées.
            </span>
          )}
        </div>
      )}
    </form>
  );
}

function InviteMemberForm({
  onInvited,
  setError,
}: {
  onInvited: () => void;
  setError: (msg: string | null) => void;
}) {
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "org_admin">("member");
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    setNotice(null);
    try {
      const created = await inviteOrgMember({
        firstname,
        lastname,
        username,
        email,
        role,
      });
      setFirstname("");
      setLastname("");
      setUsername("");
      setEmail("");
      setRole("member");
      setNotice(
        created.emailSent
          ? "Invitation envoyée par email."
          : "Membre créé. L'email n'a pas pu être envoyé (SendGrid non configuré).",
      );
      onInvited();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Erreur lors de l'invitation",
      );
    } finally {
      setStatus("idle");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-card p-5 space-y-4"
    >
      <h3 className="text-sm font-medium">Inviter un membre</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <FieldLabel htmlFor="inv-firstname">Prénom</FieldLabel>
          <TextInput
            id="inv-firstname"
            value={firstname}
            onChange={(e) => setFirstname(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="inv-lastname">Nom</FieldLabel>
          <TextInput
            id="inv-lastname"
            value={lastname}
            onChange={(e) => setLastname(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="inv-username">Nom d'utilisateur</FieldLabel>
          <TextInput
            id="inv-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="inv-email">Email</FieldLabel>
          <TextInput
            id="inv-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="inv-role">Rôle</FieldLabel>
          <RoleSelect
            id="inv-role"
            value={role}
            onChange={(v) => setRole(v as "member" | "org_admin")}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Envoi..." : "Inviter"}
        </Button>
        {notice && (
          <span className="text-sm text-muted-foreground">{notice}</span>
        )}
      </div>
    </form>
  );
}

function MemberRow({
  member,
  isSelf,
  canManage,
  onChanged,
  setError,
}: {
  member: OrgMember;
  isSelf: boolean;
  canManage: boolean;
  onChanged: () => void;
  setError: (msg: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);

  const changeRole = async (role: "member" | "org_admin") => {
    setBusy(true);
    setError(null);
    try {
      await setOrgMemberRole(member.id, role);
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Erreur de changement de rôle",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await removeOrgMember(member.id);
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
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium flex items-center gap-2">
          {member.firstname} {member.lastname}
          {isSelf && <Badge>vous</Badge>}
          {!member.activated && <Badge tone="warning">En attente</Badge>}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 truncate">
          @{member.username} · {member.email}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {canManage && member.role !== "org_owner" ? (
          <RoleSelect
            id={`role-${member.id}`}
            value={member.role === "org_admin" ? "org_admin" : "member"}
            disabled={busy}
            onChange={(v) => changeRole(v as "member" | "org_admin")}
          />
        ) : (
          <Badge tone={member.role === "org_owner" ? "primary" : "muted"}>
            {ROLE_LABELS[member.role ?? "member"]}
          </Badge>
        )}
        {canManage && !isSelf && (
          <Button
            type="button"
            variant="destructive"
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

function RoleSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
    >
      <option value="member">Membre</option>
      <option value="org_admin">Admin</option>
    </select>
  );
}
