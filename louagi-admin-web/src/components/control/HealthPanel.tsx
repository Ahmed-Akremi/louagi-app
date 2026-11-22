"use client";
import { Database, Server, Activity, Gauge } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusDot } from "./StatusDot";
import { formatNumber } from "@/lib/format";
import { useLocale } from "@/context/I18nProvider";
import type { AdminSystemHealth } from "@/types/admin";

function formatUptime(sec: number): string {
  if (!sec || sec < 0) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function HealthPanel({
  data,
  loading,
}: {
  data?: AdminSystemHealth;
  loading?: boolean;
}) {
  const { t, locale } = useLocale();
  return (
    <Card>
      <CardHeader
        title={t("admin:systemHealth", { defaultValue: "System health" })}
        subtitle={
          data
            ? `v${data.version} · ${formatUptime(data.uptimeSec)} ${t("admin:uptime", { defaultValue: "uptime" })}`
            : undefined
        }
      />
      <CardBody className="space-y-4">
        {loading ? (
          <Skeleton className="h-28 w-full" />
        ) : !data ? (
          <p className="text-sm text-text-muted">
            {t("errors:generic", { defaultValue: "Unavailable" })}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                <Database className="h-4 w-4 text-text-muted" />
                <span className="flex-1 text-sm font-medium text-text">
                  {t("admin:database", { defaultValue: "Database" })}
                </span>
                <StatusDot ok={data.db} />
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                <Server className="h-4 w-4 text-text-muted" />
                <span className="flex-1 text-sm font-medium text-text">
                  {t("admin:cache", { defaultValue: "Cache" })}
                </span>
                <StatusDot ok={data.redis} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Metric
                icon={<Gauge className="h-3.5 w-3.5" />}
                label={t("admin:avgLatency", { defaultValue: "Avg latency" })}
                value={`${formatNumber(data.avgLatencyMs, locale)} ms`}
              />
              <Metric
                icon={<Activity className="h-3.5 w-3.5" />}
                label={t("admin:queries", { defaultValue: "Queries" })}
                value={formatNumber(data.totalQueries, locale)}
              />
              <Metric
                label={t("admin:onlineDrivers", { defaultValue: "Online drivers" })}
                value={formatNumber(data.counts.onlineDrivers, locale)}
              />
              <Metric
                label={t("admin:totalUsers", { defaultValue: "Total users" })}
                value={formatNumber(data.counts.users, locale)}
              />
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-text-muted">
        {icon}
        {label}
      </span>
      <span className="font-semibold text-text">{value}</span>
    </div>
  );
}
