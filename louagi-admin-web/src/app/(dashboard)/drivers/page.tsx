"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, FileText } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Card } from "@/components/ui/Card";
import { TableWrap, Table, Th, Td, Tr } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Textarea } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows, Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { maskPhone, formatDateTime } from "@/lib/format";
import { useLocale } from "@/context/I18nProvider";
import { useToast } from "@/context/ToastProvider";
import {
  adminListDrivers,
  adminVerifyDriver,
  adminListUserDocuments,
} from "@/api/admin";
import type { AdminDriver } from "@/types/admin";

const STATUSES = ["pending", "verified", "rejected"] as const;
type DriverStatus = (typeof STATUSES)[number];

export default function DriversPage() {
  const { t, locale } = useLocale();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<DriverStatus>("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedDriver, setSelectedDriver] = useState<AdminDriver | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const driversQ = useQuery({
    queryKey: ["adminDrivers", tab],
    queryFn: () => adminListDrivers(tab),
  });

  const bulkM = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map((id) => adminVerifyDriver(id, true, null))),
    onSuccess: () => {
      toast.show(
        t("admin:bulkApprove", { defaultValue: "Approve selected" }),
        "success",
      );
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ["adminDrivers"] });
    },
    onError: () => {
      toast.show(
        t("errors:generic", { defaultValue: "Something went wrong" }),
        "error",
      );
    },
  });

  const verifyM = useMutation({
    mutationFn: (vars: { driverId: string; approve: boolean; reason: string | null }) =>
      adminVerifyDriver(vars.driverId, vars.approve, vars.reason),
    onSuccess: (res) => {
      if (res.ok) {
        toast.show(
          t("admin:driverDecisionSaved", { defaultValue: "Decision saved" }),
          "success",
        );
        closeReview();
        void queryClient.invalidateQueries({ queryKey: ["adminDrivers"] });
      } else {
        toast.show(
          res.error ??
            t("errors:generic", { defaultValue: "Something went wrong" }),
          "error",
        );
      }
    },
    onError: () => {
      toast.show(
        t("errors:generic", { defaultValue: "Something went wrong" }),
        "error",
      );
    },
  });

  const docsQ = useQuery({
    queryKey: ["userDocs", selectedDriver?.user_id],
    queryFn: () => adminListUserDocuments(selectedDriver!.user_id),
    enabled: !!selectedDriver,
  });

  const tabLabels: Record<DriverStatus, string> = {
    pending: t("admin:pending", { defaultValue: "Pending" }),
    verified: t("admin:verified", { defaultValue: "Verified" }),
    rejected: t("admin:rejected", { defaultValue: "Rejected" }),
  };

  const emptyLabels: Record<DriverStatus, string> = {
    pending: t("admin:noDriversPending", { defaultValue: "No drivers" }),
    verified: t("admin:noDriversVerified", { defaultValue: "No drivers" }),
    rejected: t("admin:noDriversRejected", { defaultValue: "No drivers" }),
  };

  const drivers = driversQ.data ?? [];

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === drivers.length
        ? new Set()
        : new Set(drivers.map((d) => d.id)),
    );
  }

  function openReview(driver: AdminDriver) {
    setRejecting(false);
    setReason("");
    setSelectedDriver(driver);
  }

  function closeReview() {
    if (verifyM.isPending) return;
    setSelectedDriver(null);
    setRejecting(false);
    setReason("");
  }

  function confirmReject() {
    if (!selectedDriver) return;
    if (!rejecting) {
      setRejecting(true);
      return;
    }
    verifyM.mutate({
      driverId: selectedDriver.id,
      approve: false,
      reason: reason.trim() || null,
    });
  }

  function confirmApprove() {
    if (!selectedDriver) return;
    verifyM.mutate({
      driverId: selectedDriver.id,
      approve: true,
      reason: null,
    });
  }

  const showCheckboxes = tab === "pending";
  const allSelected = drivers.length > 0 && selected.size === drivers.length;

  return (
    <div>
      <PageHeader
        title={t("admin:driverVerifications", {
          defaultValue: "Driver verifications",
        })}
        subtitle={t("admin:driverVerificationsSubtitle", {
          defaultValue: "Review and approve driver applications",
        })}
        actions={
          showCheckboxes ? (
            <Button
              variant="primary"
              size="sm"
              disabled={selected.size === 0}
              loading={bulkM.isPending}
              iconLeft={<ShieldCheck className="h-4 w-4" />}
              onClick={() => bulkM.mutate(Array.from(selected))}
            >
              {t("admin:bulkApproveCount", {
                defaultValue: `Approve selected (${selected.size})`,
                count: selected.size,
              })}
            </Button>
          ) : undefined
        }
      />

      <Tabs
        items={STATUSES.map((s) => ({ key: s, label: tabLabels[s] }))}
        value={tab}
        onChange={(key) => {
          setTab(key as DriverStatus);
          setSelected(new Set());
        }}
      />

      <Card className="mt-4 overflow-hidden">
        {driversQ.isLoading ? (
          <SkeletonRows rows={6} />
        ) : driversQ.isError ? (
          <div className="p-4">
            <Banner
              variant="danger"
              title={t("errors:generic", {
                defaultValue: "Couldn't load drivers",
              })}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => driversQ.refetch()}
                >
                  {t("common:retry", { defaultValue: "Retry" })}
                </Button>
              }
            />
          </div>
        ) : drivers.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-7 w-7" />}
            title={emptyLabels[tab]}
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  {showCheckboxes ? (
                    <Th className="w-10">
                      <input
                        type="checkbox"
                        aria-label={t("admin:selectAll", {
                          defaultValue: "Select all",
                        })}
                        checked={allSelected}
                        onChange={toggleAll}
                        className="h-4 w-4 cursor-pointer rounded border-border accent-brand"
                      />
                    </Th>
                  ) : null}
                  <Th>{t("admin:driver", { defaultValue: "Driver" })}</Th>
                  <Th>{t("admin:vehicle", { defaultValue: "Vehicle" })}</Th>
                  <Th>{t("admin:plate", { defaultValue: "Plate" })}</Th>
                  <Th>{t("admin:status", { defaultValue: "Status" })}</Th>
                  <Th className="text-end">
                    {t("admin:actions", { defaultValue: "Actions" })}
                  </Th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver) => {
                  const vehicle =
                    `${driver.vehicle_brand ?? ""} ${
                      driver.vehicle_model ?? ""
                    }`.trim() || "—";
                  return (
                    <Tr key={driver.id}>
                      {showCheckboxes ? (
                        <Td className="w-10">
                          <input
                            type="checkbox"
                            aria-label={t("admin:selectRow", {
                              defaultValue: "Select",
                            })}
                            checked={selected.has(driver.id)}
                            onChange={() => toggleOne(driver.id)}
                            className="h-4 w-4 cursor-pointer rounded border-border accent-brand"
                          />
                        </Td>
                      ) : null}
                      <Td className="font-medium">
                        {driver.user?.full_name ?? "—"}
                      </Td>
                      <Td className="whitespace-nowrap text-text-muted">
                        {vehicle}
                      </Td>
                      <Td className="whitespace-nowrap tabular-nums">
                        {driver.plate_number ?? "—"}
                      </Td>
                      <Td>
                        <StatusBadge status={driver.status} />
                      </Td>
                      <Td className="text-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openReview(driver)}
                        >
                          {t("admin:review", { defaultValue: "Review" })}
                        </Button>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Modal
        open={selectedDriver !== null}
        onClose={closeReview}
        title={
          selectedDriver?.user?.full_name ??
          t("admin:review", { defaultValue: "Review" })
        }
        footer={
          selectedDriver?.status === "pending" ? (
            <>
              <Button
                variant="danger"
                loading={verifyM.isPending && verifyM.variables?.approve === false}
                onClick={confirmReject}
              >
                {rejecting
                  ? t("common:confirm", { defaultValue: "Confirm" })
                  : t("admin:reject", { defaultValue: "Reject" })}
              </Button>
              <Button
                variant="primary"
                loading={verifyM.isPending && verifyM.variables?.approve === true}
                onClick={confirmApprove}
              >
                {t("admin:approve", { defaultValue: "Approve" })}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={closeReview}>
              {t("common:close", { defaultValue: "Close" })}
            </Button>
          )
        }
      >
        {selectedDriver ? (
          <div className="space-y-4">
            {selectedDriver.status === "rejected" &&
            selectedDriver.rejection_reason ? (
              <Banner
                variant="warning"
                title={t("admin:rejectReason", {
                  defaultValue: "Rejection reason",
                })}
                body={selectedDriver.rejection_reason}
              />
            ) : null}

            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              <DetailRow
                label={t("admin:idNumber", { defaultValue: "ID number" })}
                value={selectedDriver.id_card_number ?? "—"}
              />
              <DetailRow
                label={t("admin:license", { defaultValue: "License" })}
                value={selectedDriver.license_number ?? "—"}
              />
              <DetailRow
                label={t("admin:plate", { defaultValue: "Plate" })}
                value={selectedDriver.plate_number ?? "—"}
              />
              <DetailRow
                label={t("admin:vehicle", { defaultValue: "Vehicle" })}
                value={
                  `${selectedDriver.vehicle_brand ?? ""} ${
                    selectedDriver.vehicle_model ?? ""
                  }`.trim() || "—"
                }
              />
              <DetailRow
                label={t("admin:seats", { defaultValue: "Seats" })}
                value={
                  selectedDriver.seat_count != null
                    ? String(selectedDriver.seat_count)
                    : "—"
                }
              />
              <DetailRow
                label={t("admin:email", { defaultValue: "Email" })}
                value={selectedDriver.user?.email ?? "—"}
              />
              <DetailRow
                label={t("admin:phone", { defaultValue: "Phone" })}
                value={maskPhone(selectedDriver.user?.phone_number)}
              />
              {selectedDriver.verified_at ? (
                <DetailRow
                  label={t("admin:verifiedAt", { defaultValue: "Verified" })}
                  value={formatDateTime(selectedDriver.verified_at, locale)}
                />
              ) : null}
            </dl>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t("admin:documents", { defaultValue: "Documents" })}
              </p>
              {docsQ.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (docsQ.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-text-muted">
                  {t("admin:noDocuments", { defaultValue: "No documents" })}
                </p>
              ) : (
                <ul className="space-y-2">
                  {docsQ.data?.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-text-muted" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text">
                          {doc.name}
                        </p>
                        <p className="truncate text-xs text-text-muted">
                          {doc.kind}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selectedDriver.status === "pending" && rejecting ? (
              <Field
                label={t("admin:rejectReason", {
                  defaultValue: "Rejection reason",
                })}
              >
                <Textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("admin:rejectReasonPlaceholder", {
                    defaultValue: "Explain why this application is rejected",
                  })}
                />
              </Field>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{value}</dd>
    </div>
  );
}
