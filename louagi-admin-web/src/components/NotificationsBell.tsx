"use client";
// Notifications popup for the dashboard topbar. Reuses the same `adminAlerts`
// feed the overview page renders (flagged payments, failed charges, pending
// driver verifications) — there is no separate notifications operation, these
// derived alerts ARE the actionable notifications. Read state is client-side
// only (the alerts are derived, not stored records with a read flag), persisted
// in localStorage and pruned to alerts still present so the set stays bounded.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Flag,
  AlertTriangle,
  CarFront,
  CheckCircle2,
  CheckCheck,
} from "lucide-react";
import { adminAlerts } from "@/api/admin";
import type { AdminAlert } from "@/types/admin";
import { useLocale } from "@/context/I18nProvider";
import { relativeTime } from "@/lib/format";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

const ALERT_ICON: Record<string, typeof Flag> = {
  flag: Flag,
  fail: AlertTriangle,
  verification: CarFront,
};

const READ_KEY = "louagi.admin.readAlerts";

function loadReadIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(READ_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveReadIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable — read state just won't persist this session */
  }
}

export function NotificationsBell() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const alertsQ = useQuery({
    queryKey: ["adminAlerts"],
    queryFn: adminAlerts,
    refetchInterval: 30_000,
  });
  const alerts = useMemo(() => alertsQ.data ?? [], [alertsQ.data]);

  // Hydrate read state on mount (client only — avoids SSR hydration mismatch).
  useEffect(() => {
    setReadIds(loadReadIds());
  }, []);

  // Prune stored ids to alerts still present so the set can't grow unbounded.
  useEffect(() => {
    if (!alerts.length) return;
    const present = new Set(alerts.map((a) => a.id));
    setReadIds((prev) => {
      const pruned = prev.filter((id) => present.has(id));
      if (pruned.length !== prev.length) saveReadIds(pruned);
      return pruned;
    });
  }, [alerts]);

  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const unreadCount = useMemo(
    () => alerts.reduce((n, a) => (readSet.has(a.id) ? n : n + 1), 0),
    [alerts, readSet],
  );

  // Close on outside click / Escape, matching the language dropdown's behaviour.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const persist = (ids: string[]) => {
    setReadIds(ids);
    saveReadIds(ids);
  };
  const markAllRead = () =>
    persist(Array.from(new Set([...readIds, ...alerts.map((a) => a.id)])));
  const markRead = (id: string) => {
    if (readSet.has(id)) return;
    persist(Array.from(new Set([...readIds, id])));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-2 text-text-muted transition-colors hover:bg-card-muted hover:text-text"
        aria-label={t("admin:notifications", { defaultValue: "Notifications" })}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -inset-e-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute inset-e-0 mt-1 w-80 overflow-hidden rounded-lg border border-border bg-card shadow-floating">
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <span className="text-sm font-semibold text-text">
              {t("admin:notifications", { defaultValue: "Notifications" })}
            </span>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand transition-colors hover:text-brand-pressed"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t("admin:markAllRead", { defaultValue: "Mark all read" })}
              </button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {alertsQ.isLoading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
                <CheckCircle2 className="h-8 w-8 text-success" />
                <p className="text-sm font-semibold text-text">
                  {t("admin:allClearTitle", { defaultValue: "All clear" })}
                </p>
                <p className="text-xs text-text-muted">
                  {t("admin:notificationsEmpty", {
                    defaultValue: "You're all caught up.",
                  })}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {alerts.map((a) => (
                  <NotificationRow
                    key={a.id}
                    alert={a}
                    unread={!readSet.has(a.id)}
                    onSeen={() => markRead(a.id)}
                  />
                ))}
              </ul>
            )}
          </div>

          <Link
            href="/overview"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-3 py-2.5 text-center text-xs font-medium text-brand transition-colors hover:bg-card-muted"
          >
            {t("admin:viewAllAlerts", { defaultValue: "View all alerts" })}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function NotificationRow({
  alert,
  unread,
  onSeen,
}: {
  alert: AdminAlert;
  unread: boolean;
  onSeen: () => void;
}) {
  const Icon = ALERT_ICON[alert.kind] ?? AlertTriangle;
  const tone =
    alert.kind === "verification"
      ? "text-warning bg-warning-bg"
      : "text-danger bg-danger-bg";
  return (
    <li>
      <button
        type="button"
        onClick={onSeen}
        className={cn(
          "flex w-full items-start gap-3 px-3 py-3 text-start transition-colors hover:bg-card-muted",
          unread && "bg-brand/5",
        )}
      >
        <span className={cn("shrink-0 rounded-md p-1.5", tone)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text">{alert.title}</p>
          <p className="truncate text-xs text-text-muted">{alert.body}</p>
          <p className="mt-0.5 text-[11px] text-text-muted">
            {relativeTime(alert.created_at)}
          </p>
        </div>
        {unread ? (
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
        ) : null}
      </button>
    </li>
  );
}
