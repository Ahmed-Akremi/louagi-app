"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Wallet,
  Flag,
  Undo2,
  Banknote,
  Receipt,
  CreditCard,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { KpiTile } from "@/components/ui/KpiTile";
import { Tabs } from "@/components/ui/Tabs";
import { TableWrap, Table, Th, Td, Tr } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows, SkeletonKpis } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useLocale } from "@/context/I18nProvider";
import { useToast } from "@/context/ToastProvider";
import {
  listPayments,
  adminPaymentsSummary,
  adminDriverPayouts,
  adminRefund,
  adminFlagPayment,
  adminUnflagPayment,
} from "@/api/admin";
import type { Payment } from "@/types/admin";

type Tab = "all" | "flagged" | "payouts";

export default function PaymentsPage() {
  const { t, locale } = useLocale();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>("all");
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundError, setRefundError] = useState<string | null>(null);
  const [flagTarget, setFlagTarget] = useState<Payment | null>(null);
  const [flagReason, setFlagReason] = useState("");

  const summaryQ = useQuery({
    queryKey: ["paymentsSummary"],
    queryFn: adminPaymentsSummary,
  });
  const paymentsQ = useQuery({
    queryKey: ["payments"],
    queryFn: listPayments,
    enabled: tab !== "payouts",
  });
  const payoutsQ = useQuery({
    queryKey: ["driverPayouts"],
    queryFn: () => adminDriverPayouts(50),
    enabled: tab === "payouts",
  });

  const invalidatePayments = () => {
    void queryClient.invalidateQueries({ queryKey: ["payments"] });
    void queryClient.invalidateQueries({ queryKey: ["paymentsSummary"] });
  };

  const genericError = () =>
    toast.show(t("errors:generic", { defaultValue: "Something went wrong" }), "error");

  const refundM = useMutation({
    mutationFn: (vars: { paymentId: string; amount: number }) =>
      adminRefund(vars.paymentId, vars.amount),
    onSuccess: (res) => {
      if (res.ok) {
        toast.show(
          t("admin:refundIssued", { defaultValue: "Refund issued" }),
          "success",
        );
        closeRefund();
        invalidatePayments();
      } else {
        toast.show(
          res.error ?? t("errors:generic", { defaultValue: "Something went wrong" }),
          "error",
        );
      }
    },
    onError: genericError,
  });

  const flagM = useMutation({
    mutationFn: (vars: { paymentId: string; reason: string }) =>
      adminFlagPayment(vars.paymentId, vars.reason),
    onSuccess: (res) => {
      if (res.ok) {
        toast.show(
          t("admin:paymentFlagged", { defaultValue: "Payment flagged" }),
          "success",
        );
        closeFlag();
        invalidatePayments();
      } else {
        toast.show(
          res.error ?? t("errors:generic", { defaultValue: "Something went wrong" }),
          "error",
        );
      }
    },
    onError: genericError,
  });

  const unflagM = useMutation({
    mutationFn: (paymentId: string) => adminUnflagPayment(paymentId),
    onSuccess: (res) => {
      if (res.ok) {
        toast.show(
          t("admin:paymentUnflagged", { defaultValue: "Flag cleared" }),
          "success",
        );
        invalidatePayments();
      } else {
        toast.show(
          res.error ?? t("errors:generic", { defaultValue: "Something went wrong" }),
          "error",
        );
      }
    },
    onError: genericError,
  });

  const tabItems = [
    { key: "all", label: t("admin:tabAllPayments", { defaultValue: "All payments" }) },
    {
      key: "flagged",
      label: t("admin:tabFlagged", { defaultValue: "Flagged" }),
      count: summaryQ.data?.flaggedCount,
    },
    { key: "payouts", label: t("admin:tabPayouts", { defaultValue: "Payouts" }) },
  ];

  const payments = paymentsQ.data ?? [];
  const rows = tab === "flagged" ? payments.filter((p) => p.flagged) : payments;
  const payouts = payoutsQ.data ?? [];

  function openRefund(payment: Payment) {
    setRefundTarget(payment);
    setRefundAmount(String(payment.amount ?? 0));
    setRefundError(null);
  }
  function closeRefund() {
    if (refundM.isPending) return;
    setRefundTarget(null);
    setRefundAmount("");
    setRefundError(null);
  }
  function confirmRefund() {
    if (!refundTarget) return;
    const max = Number(refundTarget.amount ?? 0);
    const amount = Number(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > max) {
      setRefundError(
        t("admin:refundAmountInvalid", {
          defaultValue: "Enter an amount between 0 and the original charge.",
        }),
      );
      return;
    }
    refundM.mutate({ paymentId: refundTarget.id, amount });
  }

  function openFlag(payment: Payment) {
    setFlagTarget(payment);
    setFlagReason("");
  }
  function closeFlag() {
    if (flagM.isPending) return;
    setFlagTarget(null);
    setFlagReason("");
  }
  function confirmFlag() {
    if (!flagTarget) return;
    flagM.mutate({ paymentId: flagTarget.id, reason: flagReason.trim() });
  }

  return (
    <div>
      <PageHeader
        title={t("admin:paymentsTitle", { defaultValue: "Payments" })}
        subtitle={t("admin:paymentsSubtitle", {
          defaultValue: "Refunds, flags, and driver payouts",
        })}
      />

      {/* KPIs */}
      {summaryQ.isLoading ? (
        <SkeletonKpis />
      ) : summaryQ.isError ? (
        <Banner
          variant="danger"
          title={t("errors:generic", { defaultValue: "Couldn't load summary" })}
          action={
            <Button size="sm" variant="outline" onClick={() => summaryQ.refetch()}>
              {t("common:retry", { defaultValue: "Retry" })}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile
            label={t("admin:revenue7d", { defaultValue: "Revenue (7d)" })}
            value={formatMoney(summaryQ.data?.revenue7d, locale)}
            icon={<Wallet className="h-4 w-4" />}
          />
          <KpiTile
            label={t("admin:flaggedKpi", { defaultValue: "Flagged" })}
            value={summaryQ.data?.flaggedCount ?? 0}
            icon={<Flag className="h-4 w-4" />}
          />
          <KpiTile
            label={t("admin:refundedTotal", { defaultValue: "Refunded" })}
            value={formatMoney(summaryQ.data?.refundedSum, locale)}
            icon={<Undo2 className="h-4 w-4" />}
          />
          <KpiTile
            label={t("admin:driverFeesOwed", { defaultValue: "Driver fees owed" })}
            value={formatMoney(summaryQ.data?.driverFees, locale)}
            icon={<Banknote className="h-4 w-4" />}
          />
        </div>
      )}

      <div className="mt-6">
        <Tabs items={tabItems} value={tab} onChange={(key) => setTab(key as Tab)} />
      </div>

      {tab === "payouts" ? (
        <Card className="mt-4 overflow-hidden">
          {payoutsQ.isLoading ? (
            <SkeletonRows rows={6} />
          ) : payoutsQ.isError ? (
            <div className="p-4">
              <Banner
                variant="danger"
                title={t("errors:generic", { defaultValue: "Couldn't load payouts" })}
                action={
                  <Button size="sm" variant="outline" onClick={() => payoutsQ.refetch()}>
                    {t("common:retry", { defaultValue: "Retry" })}
                  </Button>
                }
              />
            </div>
          ) : payouts.length === 0 ? (
            <EmptyState
              icon={<CreditCard className="h-7 w-7" />}
              title={t("admin:noPayouts", { defaultValue: "No payouts" })}
              body={t("admin:noPayoutsBody", {
                defaultValue: "Driver earnings will appear here once payments settle.",
              })}
            />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>{t("admin:driver", { defaultValue: "Driver" })}</Th>
                    <Th className="text-end">
                      {t("admin:paymentsCount", { defaultValue: "Payments" })}
                    </Th>
                    <Th className="text-end">
                      {t("admin:driverFees", { defaultValue: "Driver fees" })}
                    </Th>
                    <Th className="text-end">
                      {t("admin:platformFees", { defaultValue: "Platform fees" })}
                    </Th>
                    <Th>{t("admin:lastPayment", { defaultValue: "Last payment" })}</Th>
                    <Th>{t("admin:payoutAccount", { defaultValue: "Payout account" })}</Th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => (
                    <Tr key={payout.driver_id}>
                      <Td className="font-medium">{payout.full_name}</Td>
                      <Td className="text-end tabular-nums">{payout.payments_count}</Td>
                      <Td className="whitespace-nowrap text-end tabular-nums">
                        {formatMoney(payout.driver_fees, locale)}
                      </Td>
                      <Td className="whitespace-nowrap text-end tabular-nums">
                        {formatMoney(payout.platform_fees, locale)}
                      </Td>
                      <Td className="whitespace-nowrap text-text-muted">
                        {formatDateTime(payout.last_payment_at, locale)}
                      </Td>
                      <Td>
                        {payout.payout_account ? (
                          <span className="font-mono text-xs">
                            {payout.payout_account}
                          </span>
                        ) : (
                          <Badge tone="warning">
                            {t("admin:payoutAccountMissing", {
                              defaultValue: "No payout account",
                            })}
                          </Badge>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      ) : (
        <Card className="mt-4 overflow-hidden">
          {paymentsQ.isLoading ? (
            <SkeletonRows rows={6} />
          ) : paymentsQ.isError ? (
            <div className="p-4">
              <Banner
                variant="danger"
                title={t("errors:generic", { defaultValue: "Couldn't load payments" })}
                action={
                  <Button size="sm" variant="outline" onClick={() => paymentsQ.refetch()}>
                    {t("common:retry", { defaultValue: "Retry" })}
                  </Button>
                }
              />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-7 w-7" />}
              title={
                tab === "flagged"
                  ? t("admin:noFlaggedPayments", { defaultValue: "No flagged payments" })
                  : t("admin:noPayments", { defaultValue: "No payments" })
              }
              body={
                tab === "flagged"
                  ? t("admin:noFlaggedPaymentsBody", {
                      defaultValue: "Nothing needs review right now.",
                    })
                  : undefined
              }
            />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>{t("admin:reference", { defaultValue: "Reference" })}</Th>
                    <Th className="text-end">
                      {t("admin:amount", { defaultValue: "Amount" })}
                    </Th>
                    <Th>{t("admin:status", { defaultValue: "Status" })}</Th>
                    <Th>{t("admin:date", { defaultValue: "Date" })}</Th>
                    <Th className="text-end">
                      {t("admin:actions", { defaultValue: "Actions" })}
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((payment) => {
                    const refundDisabled =
                      payment.status === "refunded" ||
                      payment.status === "failed" ||
                      payment.flagged === true;
                    return (
                      <Tr key={payment.id}>
                        <Td className="whitespace-nowrap font-mono text-xs">
                          {payment.gateway_reference ?? payment.id.slice(0, 8)}
                        </Td>
                        <Td className="whitespace-nowrap text-end tabular-nums">
                          {formatMoney(payment.amount, locale)}
                        </Td>
                        <Td>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge status={payment.status} />
                            {payment.flagged ? (
                              <Badge tone="warning">
                                {t("admin:flaggedKpi", { defaultValue: "Flagged" })}
                              </Badge>
                            ) : null}
                          </div>
                        </Td>
                        <Td className="whitespace-nowrap text-text-muted">
                          {formatDateTime(payment.paid_at, locale)}
                        </Td>
                        <Td>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={refundDisabled}
                              onClick={() => openRefund(payment)}
                            >
                              {t("admin:refund", { defaultValue: "Refund" })}
                            </Button>
                            {payment.flagged ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                loading={
                                  unflagM.isPending &&
                                  unflagM.variables === payment.id
                                }
                                onClick={() => unflagM.mutate(payment.id)}
                              >
                                {t("admin:unflag", { defaultValue: "Unflag" })}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openFlag(payment)}
                              >
                                {t("admin:flag", { defaultValue: "Flag" })}
                              </Button>
                            )}
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      )}

      {/* Refund modal */}
      <Modal
        open={refundTarget !== null}
        onClose={closeRefund}
        title={t("admin:refundPayment", { defaultValue: "Refund payment" })}
        footer={
          <>
            <Button variant="outline" onClick={closeRefund} disabled={refundM.isPending}>
              {t("common:cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button variant="danger" loading={refundM.isPending} onClick={confirmRefund}>
              {t("admin:issueRefund", { defaultValue: "Issue refund" })}
            </Button>
          </>
        }
      >
        {refundTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              {`${
                refundTarget.gateway_reference ?? refundTarget.id.slice(0, 8)
              } · ${formatMoney(refundTarget.amount, locale)}`}
            </p>
            <Field
              label={t("admin:refundAmount", { defaultValue: "Refund amount" })}
              error={refundError ?? undefined}
              hint={t("admin:maxAmount", {
                defaultValue: `Max ${formatMoney(refundTarget.amount, locale)}`,
                amount: formatMoney(refundTarget.amount, locale),
              })}
            >
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                max={refundTarget.amount}
                value={refundAmount}
                onChange={(e) => {
                  setRefundAmount(e.target.value);
                  if (refundError) setRefundError(null);
                }}
              />
            </Field>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setRefundAmount(String(refundTarget.amount ?? 0));
                setRefundError(null);
              }}
            >
              {t("admin:fullRefund", { defaultValue: "Full refund" })}
            </Button>
          </div>
        ) : null}
      </Modal>

      {/* Flag modal */}
      <Modal
        open={flagTarget !== null}
        onClose={closeFlag}
        title={t("admin:flagPayment", { defaultValue: "Flag payment" })}
        footer={
          <>
            <Button variant="outline" onClick={closeFlag} disabled={flagM.isPending}>
              {t("common:cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              variant="danger"
              loading={flagM.isPending}
              disabled={flagReason.trim().length === 0}
              onClick={confirmFlag}
            >
              {t("admin:flag", { defaultValue: "Flag" })}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Banner
            variant="warning"
            title={t("admin:flagPaymentTitle", { defaultValue: "Flag for review" })}
            body={t("admin:flagPaymentBody", {
              defaultValue:
                "Flagging holds the payment from refunds and records a note in the audit log.",
            })}
          />
          <Field label={t("admin:flagReason", { defaultValue: "Reason" })}>
            <Textarea
              rows={3}
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder={t("admin:flagReasonPlaceholder", {
                defaultValue: "Why is this payment being flagged?",
              })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
