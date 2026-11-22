"use client";
import { ReactNode } from "react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "warning" | "danger" | "brand";

const TONE_VALUE: Record<Tone, string> = {
  neutral: "text-text",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  brand: "text-brand",
};

const TONE_STROKE: Record<Tone, string> = {
  neutral: "rgb(var(--navy))",
  success: "rgb(var(--success))",
  warning: "rgb(var(--warning))",
  danger: "rgb(var(--danger))",
  brand: "rgb(var(--brand))",
};

// A compact KPI tile with an optional trailing sparkline — the building block
// of the security/ops signal rows in the command center.
export function SignalTile({
  label,
  value,
  icon,
  hint,
  series,
  tone = "neutral",
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  series?: number[];
  tone?: Tone;
}) {
  const data = (series ?? []).map((v, i) => ({ i, v }));
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {label}
        </span>
        {icon ? <span className="text-text-muted">{icon}</span> : null}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className={cn("text-2xl font-bold leading-none", TONE_VALUE[tone])}>
          {value}
        </span>
        {data.length > 1 ? (
          <div className="h-9 w-24 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`spark-${tone}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TONE_STROKE[tone]} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={TONE_STROKE[tone]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={TONE_STROKE[tone]}
                  strokeWidth={1.5}
                  fill={`url(#spark-${tone})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>
      {hint ? <div className="text-xs text-text-muted">{hint}</div> : null}
    </Card>
  );
}
