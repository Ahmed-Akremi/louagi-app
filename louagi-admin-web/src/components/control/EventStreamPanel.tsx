"use client";
import { Radio } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { useLocale } from "@/context/I18nProvider";
import type { AdminEvent, EventCategory, EventSeverity } from "@/types/admin";

const CATEGORIES: EventCategory[] = [
  "auth",
  "payment",
  "admin",
  "ride",
  "driver",
  "delivery",
  "system",
];

const SEVERITY_ACCENT: Record<EventSeverity, string> = {
  info: "bg-info",
  warning: "bg-warning",
  danger: "bg-danger",
};

const SEVERITY_CHIP: Record<EventSeverity, string> = {
  info: "bg-info-bg text-info",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
};

function shortId(id?: string | null): string {
  if (!id) return "—";
  return id.length > 8 ? id.slice(0, 8) : id;
}

export function EventStreamPanel({
  events,
  loading,
  selected,
  onToggle,
  live = true,
}: {
  events: AdminEvent[];
  loading?: boolean;
  selected: Set<EventCategory>;
  onToggle: (c: EventCategory) => void;
  live?: boolean;
}) {
  const { t } = useLocale();

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            {t("admin:eventStream", { defaultValue: "Event stream" })}
            {live ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
                <Radio className="h-3 w-3 animate-pulse" />
                {t("admin:live", { defaultValue: "LIVE" })}
              </span>
            ) : null}
          </span>
        }
        subtitle={t("admin:eventStreamSubtitle", {
          defaultValue: "Security & operational events across the platform",
        })}
      />
      <CardBody>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const on = selected.size === 0 || selected.has(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => onToggle(c)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                  on
                    ? "bg-navy text-white dark:bg-navy/20 dark:text-navy"
                    : "bg-card-muted text-text-muted hover:text-text",
                )}
              >
                {t(`admin:cat_${c}`, { defaultValue: c })}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : events.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-muted">
            {t("admin:noEvents", { defaultValue: "No events match this filter." })}
          </p>
        ) : (
          <ul className="scrollbar-thin max-h-112 divide-y divide-border overflow-y-auto">
            {events.map((e) => (
              <li key={e.id} className="flex items-start gap-3 py-2.5">
                <span
                  className={cn(
                    "mt-1 h-full w-1 shrink-0 self-stretch rounded-full",
                    SEVERITY_ACCENT[e.severity],
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                        SEVERITY_CHIP[e.severity],
                      )}
                    >
                      {t(`admin:cat_${e.category}`, { defaultValue: e.category })}
                    </span>
                    <code className="truncate font-mono text-xs font-medium text-text">
                      {e.action}
                    </code>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-text-muted">
                    {e.actor
                      ? `${e.actor.role} · ${shortId(e.actor.id)}`
                      : t("admin:systemActor", { defaultValue: "system" })}
                    {e.target ? ` → ${e.target.type} ${shortId(e.target.id)}` : ""}
                    {e.ip && e.ip !== "server" ? ` · ${e.ip}` : ""}
                  </div>
                </div>
                <span className="shrink-0 whitespace-nowrap text-[11px] text-text-muted">
                  {relativeTime(e.ts)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
