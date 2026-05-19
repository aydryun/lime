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

/** Returns the persisted UI language, defaulting to "fr" if unset or invalid. */
export function getStoredLanguage(): Language {
  const value = safeGetItem(LANGUAGE_STORAGE_KEY);
  return value === "en" || value === "fr" ? value : "fr";
}

/** Persists the chosen UI language in localStorage. */
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

/** Returns the persisted notification preferences, merged onto the defaults. */
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

/** Persists the notification preferences in localStorage. */
export function setStoredNotifications(prefs: NotificationPreferences): void {
  safeSetItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(prefs));
}
