"use client";
import { ShieldAlert, TrendingUp } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMoney, formatNumber } from "@/lib/format";
import { useLocale } from "@/context/I18nProvider";
import type { AdminRiskSignals } from "@/types/admin";

export function RiskPanel({
  data,
  loading,
}: {
  data?: AdminRiskSignals;
  loading?: boolean;
}) {
  const { t, locale } = useLocale();
  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-text-muted" />
            {t("admin:riskFraud", { defaultValue: "Risk & fraud" })}
          </span>
        }
        action={
          data?.refundSpike ? (
            <Badge tone="danger">
              <TrendingUp className="h-3 w-3" />
              {t("admin:refundSpike", { defaultValue: "Refund spike" })}
            </Badge>
          ) : null
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
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-text-muted">
                  {t("admin:flaggedPayments", { defaultValue: "Flagged payments" })}
                </div>
                <div className="mt-1 text-xl font-bold text-text">
                  {formatNumber(data.flaggedCount, locale)}
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-text-muted">
                  {t("admin:refunds7d", { defaultValue: "Refunds (7d)" })}
                </div>
                <div className="mt-1 text-xl font-bold text-text">
                  {formatMoney(data.refund7dSum, locale)}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                {t("admin:topRefunded", { defaultValue: "Top refunded users" })}
              </div>
              {data.topRefundedUsers.length === 0 ? (
                <p className="text-sm text-text-muted">
                  {t("admin:none", { defaultValue: "None" })}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {data.topRefundedUsers.map((u) => (
                    <li
                      key={u.userId}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="truncate text-text">{u.fullName}</span>
                      <span className="shrink-0 font-semibold text-danger">
                        {formatMoney(u.refundedSum, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
