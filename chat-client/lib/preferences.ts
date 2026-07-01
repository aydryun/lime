export type Language = "fr" | "en";

const LANGUAGE_STORAGE_KEY = "chat_language";
const NOTIFICATIONS_STORAGE_KEY = "chat_notifications";

export type NotificationPreferences = {
  desktop: boolean;
  sounds: boolean;
  mentionsOnly: boolean;
};

export const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  desktop: true,
  sounds: true,
  mentionsOnly: false,
};

function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`Failed to write ${key} to localStorage`, err);
  }
}

/** Renvoie la langue d'interface persistée, « fr » par défaut si absente ou invalide. */
export function getStoredLanguage(): Language {
  const value = safeGetItem(LANGUAGE_STORAGE_KEY);
  return value === "en" || value === "fr" ? value : "fr";
}

/** Persiste la langue d'interface choisie dans le localStorage. */
export function setStoredLanguage(language: Language): void {
  safeSetItem(LANGUAGE_STORAGE_KEY, language);
}

function isNotificationPreferences(
  value: unknown,
): value is Partial<NotificationPreferences> {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.desktop === undefined || typeof v.desktop === "boolean") &&
    (v.sounds === undefined || typeof v.sounds === "boolean") &&
    (v.mentionsOnly === undefined || typeof v.mentionsOnly === "boolean")
  );
}

/** Renvoie les préférences de notification persistées, fusionnées avec les valeurs par défaut. */
export function getStoredNotifications(): NotificationPreferences {
  const raw = safeGetItem(NOTIFICATIONS_STORAGE_KEY);
  if (!raw) return DEFAULT_NOTIFICATIONS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isNotificationPreferences(parsed)) return DEFAULT_NOTIFICATIONS;
    return { ...DEFAULT_NOTIFICATIONS, ...parsed };
  } catch {
    return DEFAULT_NOTIFICATIONS;
  }
}

/** Persiste les préférences de notification dans le localStorage. */
export function setStoredNotifications(prefs: NotificationPreferences): void {
  safeSetItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(prefs));
}
