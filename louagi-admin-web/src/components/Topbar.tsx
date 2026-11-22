"use client";
import { useState } from "react";
import { Moon, Sun, Globe, LogOut } from "lucide-react";
import { useTheme } from "@/context/ThemeProvider";
import { useLocale } from "@/context/I18nProvider";
import { useAuth } from "@/context/AuthProvider";
import { NotificationsBell } from "@/components/NotificationsBell";
import { cn } from "@/lib/cn";

export function Topbar() {
  const { isDark, toggle } = useTheme();
  const { locale, setLocale, locales, labels, t } = useLocale();
  const { user, logout } = useAuth();
  const [langOpen, setLangOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-end gap-1.5 border-b border-border bg-card/95 px-4 backdrop-blur-sm lg:px-6">
      <NotificationsBell />

      <button
        type="button"
        onClick={toggle}
        className="rounded-md p-2 text-text-muted transition-colors hover:bg-card-muted hover:text-text"
        aria-label="Toggle theme"
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setLangOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-md p-2 text-text-muted transition-colors hover:bg-card-muted hover:text-text"
        >
          <Globe className="h-4 w-4" />
          <span className="text-sm">{labels[locale]}</span>
        </button>
        {langOpen ? (
          <div
            className="absolute inset-e-0 mt-1 w-36 overflow-hidden rounded-md border border-border bg-card shadow-floating"
            onMouseLeave={() => setLangOpen(false)}
          >
            {locales.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setLocale(l);
                  setLangOpen(false);
                }}
                className={cn(
                  "block w-full px-3 py-2 text-start text-sm hover:bg-card-muted",
                  l === locale ? "font-medium text-brand" : "text-text",
                )}
              >
                {labels[l]}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mx-1 h-6 w-px bg-border" />

      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-bold text-white dark:bg-navy/20 dark:text-navy">
          {(user?.name || "A").slice(0, 1).toUpperCase()}
        </div>
        <div className="hidden sm:block">
          <div className="text-sm font-medium leading-none text-text">
            {user?.name}
          </div>
          <div className="mt-0.5 text-[11px] text-text-muted">
            {t("admin:administrator", { defaultValue: "Administrator" })}
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="ms-1 rounded-md p-2 text-text-muted transition-colors hover:bg-danger-bg hover:text-danger"
          aria-label={t("auth:signout", { defaultValue: "Sign out" })}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
