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

export function getStoredLanguage(): Language {
  if (typeof window === "undefined") return "fr";
  const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return value === "en" || value === "fr" ? value : "fr";
}

export function setStoredLanguage(language: Language): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

export function getStoredNotifications(): NotificationPreferences {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATIONS;
  const raw = window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
  if (!raw) return DEFAULT_NOTIFICATIONS;
  try {
    return { ...DEFAULT_NOTIFICATIONS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_NOTIFICATIONS;
  }
}

export function setStoredNotifications(prefs: NotificationPreferences): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(prefs));
}
