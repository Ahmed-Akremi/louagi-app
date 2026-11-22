"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Activity,
  CalendarCheck,
  Wallet,
  UserPlus,
  CarFront,
  BadgeCheck,
  Flag,
  Bell,
  KeyRound,
  Lock,
  UserCog,
  ShieldCheck,
  Send,
  CreditCard,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { KpiTile } from "@/components/ui/KpiTile";
import { Skeleton, SkeletonKpis } from "@/components/ui/Skeleton";
import { SignalTile } from "@/components/control/SignalTile";
import { HealthPanel } from "@/components/control/HealthPanel";
import { RiskPanel } from "@/components/control/RiskPanel";
import { EventStreamPanel } from "@/components/control/EventStreamPanel";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber } from "@/lib/format";
import { useLocale } from "@/context/I18nProvider";
import {
  adminStats,
  adminTimeSeries,
  adminSystemHealth,
  adminSecuritySignals,
  adminRiskSignals,
  adminEventStream,
} from "@/api/admin";
import type { EventCategory } from "@/types/admin";

type Metric = "revenue" | "bookings" | "rides" | "newUsers";

export default function CommandCenterPage() {
  const { t, locale } = useLocale();
  const [days, setDays] = useState(14);
  const [metric, setMetric] = useState<Metric>("revenue");
  const [cats, setCats] = useState<Set<EventCategory>>(new Set());

  const statsQ = useQuery({
    queryKey: ["adminStats"],
    queryFn: adminStats,
    refetchInterval: 15_000,
  });
  const healthQ = useQuery({
    queryKey: ["adminSystemHealth"],
    queryFn: adminSystemHealth,
    refetchInterval: 15_000,
  });
  const secQ = useQuery({
    queryKey: ["adminSecuritySignals"],
    queryFn: adminSecuritySignals,
    refetchInterval: 30_000,
  });
  const riskQ = useQuery({
    queryKey: ["adminRiskSignals"],
    queryFn: adminRiskSignals,
    refetchInterval: 60_000,
  });
  const eventsQ = useQuery({
    queryKey: ["adminEventStream"],
    queryFn: () => adminEventStream({ limit: 60 }),
    refetchInterval: 10_000,
  });
  const seriesQ = useQuery({
    queryKey: ["adminTimeSeries", days],
    queryFn: () => adminTimeSeries(days),
  });

  const toggleCat = (c: EventCategory) =>
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  const events = useMemo(() => {
    const all = eventsQ.data ?? [];
    if (cats.size === 0) return all;
    return all.filter((e) => cats.has(e.category));
  }, [eventsQ.data, cats]);

  const metricMeta: Record<Metric, { label: string; money?: boolean }> = {
    revenue: { label: t("admin:metricRevenue", { defaultValue: "Revenue" }), money: true },
    bookings: { label: t("admin:metricBookings", { defaultValue: "Bookings" }) },
    rides: { label: t("admin:metricRides", { defaultValue: "Rides" }) },
    newUsers: { label: t("admin:metricNewUsers", { defaultValue: "New users" }) },
  };

  const chartData = useMemo(() => {
    const s = seriesQ.data;
    if (!s) return [];
    const start = new Date(s.start);
    const values = s[metric] ?? [];
    return values.map((value, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return {
        label: new Intl.DateTimeFormat(
          locale === "ar" ? "ar-TN" : locale === "fr" ? "fr-FR" : "en-GB",
          { day: "numeric", month: "short" },
        ).format(d),
        value,
      };
    });
  }, [seriesQ.data, metric, locale]);

  const total = useMemo(
    () => chartData.reduce((acc, p) => acc + (p.value || 0), 0),
    [chartData],
  );

  const sec = secQ.data;

  return (
    <div>
      <PageHeader
        title={t("admin:commandCenter", { defaultValue: "Command center" })}
        subtitle={t("admin:commandCenterSubtitle", {
          defaultValue: "Live operations, security & risk — one cockpit",
        })}
      />

      {/* KPI strip */}
      {statsQ.isLoading ? (
        <SkeletonKpis />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile
            label={t("admin:activeRides", { defaultValue: "Active rides" })}
            value={formatNumber(statsQ.data?.activeRides, locale)}
            icon={<Activity className="h-4 w-4" />}
          />
          <KpiTile
            label={t("admin:bookingsToday", { defaultValue: "Bookings today" })}
            value={formatNumber(statsQ.data?.bookingsToday, locale)}
            icon={<CalendarCheck className="h-4 w-4" />}
          />
          <KpiTile
            label={t("admin:revenueToday", { defaultValue: "Revenue today" })}
            value={formatMoney(statsQ.data?.revenueToday, locale)}
            icon={<Wallet className="h-4 w-4" />}
          />
          <KpiTile
            label={t("admin:newUsers24h", { defaultValue: "New users (24h)" })}
            value={formatNumber(statsQ.data?.newUsers, locale)}
            icon={<UserPlus className="h-4 w-4" />}
          />
          <KpiTile
            label={t("admin:onlineDrivers", { defaultValue: "Online drivers" })}
            value={formatNumber(statsQ.data?.onlineDrivers, locale)}
            icon={<CarFront className="h-4 w-4" />}
          />
          <KpiTile
            label={t("admin:pendingVerifications", { defaultValue: "Pending verifications" })}
            value={formatNumber(statsQ.data?.pendingVerifications, locale)}
            icon={<BadgeCheck className="h-4 w-4" />}
          />
          <KpiTile
            label={t("admin:flaggedPayments", { defaultValue: "Flagged payments" })}
            value={formatNumber(statsQ.data?.flaggedPayments, locale)}
            icon={<Flag className="h-4 w-4" />}
          />
          <KpiTile
            label={t("admin:openAlerts", { defaultValue: "Open alerts" })}
            value={formatNumber(statsQ.data?.openAlerts, locale)}
            icon={<Bell className="h-4 w-4" />}
          />
        </div>
      )}

      {/* Security signals */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SignalTile
          label={t("admin:failedLogins24h", { defaultValue: "Failed logins (24h)" })}
          value={formatNumber(sec?.failedLogins24h, locale)}
          icon={<KeyRound className="h-4 w-4" />}
          series={sec?.series.failedLogins}
          tone={(sec?.failedLogins24h ?? 0) > 0 ? "danger" : "neutral"}
        />
        <SignalTile
          label={t("admin:activeLockouts", { defaultValue: "Active lockouts" })}
          value={formatNumber(sec?.activeLockouts, locale)}
          icon={<Lock className="h-4 w-4" />}
          tone={(sec?.activeLockouts ?? 0) > 0 ? "warning" : "neutral"}
        />
        <SignalTile
          label={t("admin:impersonationsToday", { defaultValue: "Impersonations (today)" })}
          value={formatNumber(sec?.impersonationsToday, locale)}
          icon={<UserCog className="h-4 w-4" />}
          tone={(sec?.impersonationsToday ?? 0) > 0 ? "warning" : "neutral"}
        />
        <SignalTile
          label={t("admin:adminActionsToday", { defaultValue: "Admin actions (today)" })}
          value={formatNumber(sec?.adminActionsToday, locale)}
          icon={<ShieldCheck className="h-4 w-4" />}
          tone="brand"
        />
      </div>

      {/* Event stream + health/risk */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <EventStreamPanel
            events={events}
            loading={eventsQ.isLoading}
            selected={cats}
            onToggle={toggleCat}
            live={!eventsQ.isError}
          />
        </div>
        <div className="space-y-6">
          <HealthPanel data={healthQ.data ?? undefined} loading={healthQ.isLoading} />
          <RiskPanel data={riskQ.data ?? undefined} loading={riskQ.isLoading} />
        </div>
      </div>

      {/* Trends + quick actions */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={t("admin:trendsTitle", { defaultValue: "Trends" })}
            subtitle={`${metricMeta[metric].label} · ${
              metricMeta[metric].money ? formatMoney(total, locale) : formatNumber(total, locale)
            }`}
            action={
              <div className="flex gap-1">
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      days === d
                        ? "bg-brand/10 text-brand"
                        : "text-text-muted hover:bg-card-muted",
                    )}
                  >
                    {t("admin:daysShort", { defaultValue: `${d}d`, count: d })}
                  </button>
                ))}
              </div>
            }
          />
          <CardBody>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(Object.keys(metricMeta) as Metric[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    metric === m
                      ? "bg-navy text-white dark:bg-navy/20 dark:text-navy"
                      : "bg-card-muted text-text-muted hover:text-text",
                  )}
                >
                  {metricMeta[m].label}
                </button>
              ))}
            </div>
            {seriesQ.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#DC2626" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#DC2626" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={20}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                    />
                    <Tooltip content={<ChartTooltip money={metricMeta[metric].money} locale={locale} />} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#DC2626"
                      strokeWidth={2}
                      fill="url(#fill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("admin:quickActions", { defaultValue: "Quick actions" })} />
          <CardBody className="space-y-2">
            <QuickAction
              href="/broadcast"
              icon={<Send className="h-4 w-4" />}
              label={t("admin:sendNotification", { defaultValue: "Send notification" })}
            />
            <QuickAction
              href="/drivers"
              icon={<BadgeCheck className="h-4 w-4" />}
              label={t("admin:reviewDrivers", { defaultValue: "Review pending drivers" })}
              badge={statsQ.data?.pendingVerifications}
            />
            <QuickAction
              href="/payments"
              icon={<CreditCard className="h-4 w-4" />}
              label={t("admin:reviewFlagged", { defaultValue: "View flagged payments" })}
              badge={statsQ.data?.flaggedPayments}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-text transition-colors hover:bg-card-muted"
    >
      <span className="text-navy dark:text-navy">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-on-brand">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

interface TooltipPayload {
  payload?: { label?: string; value?: number };
}
function ChartTooltip({
  active,
  payload,
  money,
  locale,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  money?: boolean;
  locale: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-floating">
      <div className="font-medium text-text-muted">{point.label}</div>
      <div className="mt-0.5 font-bold text-text">
        {money
          ? formatMoney(point.value, locale)
          : formatNumber(point.value, locale)}
      </div>
    </div>
  );
}
