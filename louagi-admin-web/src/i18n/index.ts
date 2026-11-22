"use client";
// i18next initialization for the web admin app. Reuses the EXACT locale JSON
// from the mobile app (copied into ./locales), including the `admin`, `status`,
// `errors`, and `toast` namespaces — so labels stay in sync with the contract.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import fr from "./locales/fr.json";
import ar from "./locales/ar.json";

export const SUPPORTED_LOCALES = ["en", "fr", "ar"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const RTL_LOCALES = new Set<string>(["ar"]);

// Autonyms for the language switcher.
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية",
};

export function clampLocale(input?: string | null): Locale {
  if (!input) return "en";
  const code = String(input).slice(0, 2).toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(code)
    ? (code as Locale)
    : "en";
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: { en, fr, ar },
    lng: "en",
    fallbackLng: "en",
    defaultNS: "common",
    ns: [
      "common",
      "auth",
      "landing",
      "search",
      "ride",
      "booking",
      "passenger",
      "driver",
      "admin",
      "settings",
      "errors",
      "toast",
      "delivery",
      "support",
      "chat",
      "tabs",
      "status",
    ],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    returnNull: false,
  });
}

export default i18n;
