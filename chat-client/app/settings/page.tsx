"use client";

import {
  ArrowLeft,
  Bell,
  Building2,
  Citrus,
  Monitor,
  Moon,
  Palette,
  Shield,
  Sun,
  User,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { type FormEvent, useEffect, useState } from "react";
import { OrganisationSection } from "@/components/settings/organisation-section";
import { TeamsSection } from "@/components/settings/teams-section";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api";
import { type AuthUser, getStoredUser, setStoredUser } from "@/lib/auth";
import {
  DEFAULT_NOTIFICATIONS,
  getStoredLanguage,
  getStoredNotifications,
  type Language,
  type NotificationPreferences,
  setStoredLanguage,
  setStoredNotifications,
} from "@/lib/preferences";

type Section =
  | "account"
  | "organisation"
  | "teams"
  | "appearance"
  | "notifications"
  | "privacy";

const SECTIONS: { id: Section; label: string; icon: typeof User }[] = [
  { id: "account", label: "Compte", icon: User },
  { id: "organisation", label: "Organisation", icon: Building2 },
  { id: "teams", label: "Équipes", icon: Users },
  { id: "appearance", label: "Personnalisation", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "privacy", label: "Confidentialité", icon: Shield },
];

export default function SettingsPage() {
  const router = useRouter();
  const [section, setSection] = useState<Section>("account");
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <aside className="w-64 bg-sidebar/50 border-r border-border flex flex-col shrink-0">
        <div className="h-14 border-b border-border flex items-center px-4 gap-3 shadow-sm">
          <button
            type="button"
            aria-label="Retour au chat"
            onClick={() => router.push("/chat")}
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold">Paramètres</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const isActive = section === id;
            return (
              <button
                type="button"
                key={id}
                onClick={() => setSection(id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-left transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-10">
          {section === "account" && (
            <AccountSection user={user} onUpdate={setUser} />
          )}
          {section === "organisation" && <OrganisationSection />}
          {section === "teams" && <TeamsSection />}
          {section === "appearance" && <AppearanceSection />}
          {section === "notifications" && <NotificationsSection />}
          {section === "privacy" && <PrivacySection />}
        </div>
      </main>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium leading-none">
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function AccountSection({
  user,
  onUpdate,
}: {
  user: AuthUser | null;
  onUpdate: (user: AuthUser) => void;
}) {
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setFirstname(user.firstname);
    setLastname(user.lastname);
    setUsername(user.username);
    setEmail(user.email);
  }, [user]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setStatus("saving");
    setError(null);

    try {
      const response = await fetch(apiUrl("/api/users/me"), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstname, lastname, email, username }),
      });

      const data = (await response.json()) as AuthUser | { error: string };

      if (!response.ok) {
        const message =
          "error" in data ? data.error : "Erreur lors de la mise à jour";
        setError(message);
        setStatus("idle");
        return;
      }

      const updated = data as AuthUser;
      setStoredUser(updated);
      onUpdate(updated);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setError("Impossible de joindre le serveur");
      setStatus("idle");
    }
  };

  return (
    <>
      <SectionHeader
        title="Compte"
        description="Gérez les informations associées à votre compte."
      />
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <FieldLabel htmlFor="firstname">Prénom</FieldLabel>
            <TextInput
              id="firstname"
              value={firstname}
              onChange={(e) => setFirstname(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="lastname">Nom</FieldLabel>
            <TextInput
              id="lastname"
              value={lastname}
              onChange={(e) => setLastname(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="username">Nom d'utilisateur</FieldLabel>
          <TextInput
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="email">Adresse email</FieldLabel>
          <TextInput
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {error && (
          <p
            role="alert"
            className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2"
          >
            {error}
          </p>
        )}
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={!user || status === "saving"}>
            {status === "saving" ? "Enregistrement..." : "Enregistrer"}
          </Button>
          {status === "saved" && (
            <span className="text-sm text-muted-foreground">
              Modifications enregistrées.
            </span>
          )}
        </div>
      </form>
    </>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [language, setLanguage] = useState<Language>("fr");

  useEffect(() => {
    setLanguage(getStoredLanguage());
  }, []);

  const handleLanguageChange = (value: Language) => {
    setLanguage(value);
    setStoredLanguage(value);
  };

  const themes: { value: string; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Clair", icon: Sun },
    { value: "dark", label: "Sombre", icon: Moon },
    { value: "system", label: "Système", icon: Monitor },
    { value: "lime", label: "Lime", icon: Citrus },
  ];

  return (
    <>
      <SectionHeader
        title="Personnalisation"
        description="Adaptez l'apparence et la langue de l'interface."
      />

      <div className="space-y-8">
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-medium">Thème</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choisissez l'apparence visuelle.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {themes.map(({ value, label, icon: Icon }) => {
              const isActive = theme === value;
              return (
                <button
                  type="button"
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-sm transition-colors ${
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-medium">Langue</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Langue d'affichage de l'application.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            {(
              [
                { value: "fr", label: "Français" },
                { value: "en", label: "English" },
              ] as { value: Language; label: string }[]
            ).map(({ value, label }) => {
              const isActive = language === value;
              return (
                <button
                  type="button"
                  key={value}
                  onClick={() => handleLanguageChange(value)}
                  className={`rounded-lg border px-4 py-3 text-sm transition-colors ${
                    isActive
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function NotificationsSection() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATIONS,
  );

  useEffect(() => {
    setPrefs(getStoredNotifications());
  }, []);

  const toggle = (key: keyof NotificationPreferences) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setStoredNotifications(next);
  };

  const rows: {
    key: keyof NotificationPreferences;
    title: string;
    description: string;
  }[] = [
    {
      key: "desktop",
      title: "Notifications bureau",
      description: "Recevoir des notifications de votre navigateur.",
    },
    {
      key: "sounds",
      title: "Sons",
      description: "Jouer un son lors d'un nouveau message.",
    },
    {
      key: "mentionsOnly",
      title: "Mentions uniquement",
      description: "Ne notifier que lorsque vous êtes mentionné.",
    },
  ];

  return (
    <>
      <SectionHeader
        title="Notifications"
        description="Choisissez comment et quand vous êtes notifié."
      />
      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        {rows.map(({ key, title, description }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-4 px-5 py-4"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium">{title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {description}
              </div>
            </div>
            <Toggle checked={prefs[key]} onChange={() => toggle(key)} />
          </div>
        ))}
      </div>
    </>
  );
}

function PrivacySection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Le nouveau mot de passe doit faire au moins 8 caractères.");
      return;
    }

    setStatus("saving");
    try {
      const response = await fetch(apiUrl("/api/users/me/password"), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = (await response.json()) as
        | { message: string }
        | { error: string };

      if (!response.ok) {
        const message =
          "error" in data
            ? data.error
            : "Erreur lors du changement de mot de passe";
        setError(message);
        setStatus("idle");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setError("Impossible de joindre le serveur");
      setStatus("idle");
    }
  };

  return (
    <>
      <SectionHeader
        title="Confidentialité"
        description="Gérez la sécurité de votre compte."
      />
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <FieldLabel htmlFor="current-password">
            Mot de passe actuel
          </FieldLabel>
          <TextInput
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="new-password">Nouveau mot de passe</FieldLabel>
          <TextInput
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="confirm-password">
            Confirmer le mot de passe
          </FieldLabel>
          <TextInput
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <p
            role="alert"
            className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2"
          >
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={status === "saving"}>
            {status === "saving" ? "Mise à jour..." : "Mettre à jour"}
          </Button>
          {status === "saved" && (
            <span className="text-sm text-muted-foreground">
              Mot de passe mis à jour.
            </span>
          )}
        </div>
      </form>
    </>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
