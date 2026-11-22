"use client";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import i18n, {
  LOCALE_LABELS,
  Locale,
  RTL_LOCALES,
  SUPPORTED_LOCALES,
  clampLocale,
} from "@/i18n";

interface LocaleContextValue {
  locale: Locale;
  isRTL: boolean;
  setLocale: (locale: Locale) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
  locales: readonly Locale[];
  labels: Record<Locale, string>;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);
const STORAGE_KEY = "louagi.admin.locale";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [, force] = useState(0);

  const apply = useCallback((next: Locale) => {
    void i18n.changeLanguage(next);
    setLocaleState(next);
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
      document.documentElement.dir = RTL_LOCALES.has(next) ? "rtl" : "ltr";
    }
  }, []);

  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    apply(clampLocale(saved));
  }, [apply]);

  // Re-render consumers whenever the active language changes.
  useEffect(() => {
    const handler = () => force((n) => n + 1);
    i18n.on("languageChanged", handler);
    return () => {
      i18n.off("languageChanged", handler);
    };
  }, []);

  const setLocale = useCallback(
    (next: Locale) => {
      apply(next);
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, next);
    },
    [apply],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      isRTL: RTL_LOCALES.has(locale),
      setLocale,
      t: (key, opts) => i18n.t(key, opts ?? {}) as string,
      locales: SUPPORTED_LOCALES,
      labels: LOCALE_LABELS,
    }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const v = useContext(LocaleContext);
  if (!v) throw new Error("useLocale must be used inside I18nProvider");
  return v;
}
