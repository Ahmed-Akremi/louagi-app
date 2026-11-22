"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Route as RouteIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Card } from "@/components/ui/Card";
import { TableWrap, Table, Th, Td, Tr } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Textarea } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useLocale } from "@/context/I18nProvider";
import { useToast } from "@/context/ToastProvider";
import { adminListRides, cancelRide } from "@/api/admin";
import type { AdminRide } from "@/types/admin";

const STATUSES = ["scheduled", "in_progress", "completed", "cancelled"] as const;
type RideStatus = (typeof STATUSES)[number];

export default function RidesPage() {
  const { t, locale } = useLocale();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<RideStatus>("scheduled");
  const [cancelTarget, setCancelTarget] = useState<AdminRide | null>(null);
  const [reason, setReason] = useState("");

  const ridesQ = useQuery({
    queryKey: ["adminRides", status],
    queryFn: () => adminListRides({ status }),
  });

  const cancelM = useMutation({
    mutationFn: (vars: { rideId: string; reason: string }) =>
      cancelRide(vars.rideId, vars.reason),
    onSuccess: (res) => {
      if (res.ok) {
        toast.show(
          t("admin:cancelAndRefund", {
            defaultValue: "Ride cancelled and passengers refunded",
          }),
          "success",
        );
        setCancelTarget(null);
        setReason("");
        void queryClient.invalidateQueries({ queryKey: ["adminRides"] });
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

  const tabLabels: Record<RideStatus, string> = {
    scheduled: t("admin:scheduled", { defaultValue: "Scheduled" }),
    in_progress: t("admin:live", { defaultValue: "Live" }),
    completed: t("admin:done", { defaultValue: "Completed" }),
    cancelled: t("admin:cancelled", { defaultValue: "Cancelled" }),
  };

  const rides = ridesQ.data ?? [];

  function closeCancel() {
    if (cancelM.isPending) return;
    setCancelTarget(null);
    setReason("");
  }

  function confirmCancel() {
    if (!cancelTarget) return;
    cancelM.mutate({
      rideId: cancelTarget.id,
      reason: reason.trim() || "admin-cancel",
    });
  }

  return (
    <div>
      <PageHeader
        title={t("admin:rideOversight", { defaultValue: "Ride oversight" })}
        subtitle={t("admin:rideOversightSubtitle", {
          defaultValue: "Monitor and intervene on platform rides",
        })}
      />

      <Tabs
        items={STATUSES.map((s) => ({ key: s, label: tabLabels[s] }))}
        value={status}
        onChange={(key) => setStatus(key as RideStatus)}
      />

      <Card className="mt-4 overflow-hidden">
        {ridesQ.isLoading ? (
          <SkeletonRows rows={6} />
        ) : ridesQ.isError ? (
          <div className="p-4">
            <Banner
              variant="danger"
              title={t("errors:generic", { defaultValue: "Couldn't load rides" })}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => ridesQ.refetch()}
                >
                  {t("common:retry", { defaultValue: "Retry" })}
                </Button>
              }
            />
          </div>
        ) : rides.length === 0 ? (
          <EmptyState
            icon={<RouteIcon className="h-7 w-7" />}
            title={t("admin:rideOversight", { defaultValue: "No rides" })}
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>{t("admin:route", { defaultValue: "Route" })}</Th>
                  <Th>{t("admin:departure", { defaultValue: "Departure" })}</Th>
                  <Th>{t("admin:seatsFree", { defaultValue: "Seats (free)" })}</Th>
                  <Th>{t("admin:price", { defaultValue: "Price" })}</Th>
                  <Th>{t("admin:status", { defaultValue: "Status" })}</Th>
                  <Th className="text-end">
                    {t("admin:actions", { defaultValue: "Actions" })}
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rides.map((ride) => (
                  <Tr key={ride.id}>
                    <Td className="font-medium">
                      {`${ride.route?.origin_city ?? "—"} → ${
                        ride.route?.destination_city ?? "—"
                      }`}
                    </Td>
                    <Td className="whitespace-nowrap text-text-muted">
                      {formatDateTime(ride.departure_time, locale)}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">
                      {`${ride.available_seats}/${ride.total_seats}`}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">
                      {formatMoney(ride.price_per_seat, locale)}
                    </Td>
                    <Td>
                      <StatusBadge status={ride.status} />
                    </Td>
                    <Td className="text-end">
                      {ride.status === "scheduled" ? (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            setReason("");
                            setCancelTarget(ride);
                          }}
                        >
                          {t("admin:cancel", { defaultValue: "Cancel" })}
                        </Button>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Modal
        open={cancelTarget !== null}
        onClose={closeCancel}
        title={t("admin:cancelRide", { defaultValue: "Cancel ride" })}
        footer={
          <>
            <Button
              variant="outline"
              onClick={closeCancel}
              disabled={cancelM.isPending}
            >
              {t("common:cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              variant="danger"
              loading={cancelM.isPending}
              onClick={confirmCancel}
            >
              {t("common:confirm", { defaultValue: "Confirm" })}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Banner
            variant="warning"
            title={t("admin:adminOverrideTitle", {
              defaultValue: "Admin override",
            })}
            body={t("admin:adminOverrideBody", {
              defaultValue:
                "This bypasses the passenger cancellation window and refunds all confirmed passengers.",
            })}
          />
          {cancelTarget ? (
            <p className="text-sm text-text-muted">
              {`${cancelTarget.route?.origin_city ?? "—"} → ${
                cancelTarget.route?.destination_city ?? "—"
              } · ${formatDateTime(cancelTarget.departure_time, locale)}`}
            </p>
          ) : null}
          <Field
            label={t("admin:cancelReason", {
              defaultValue: "Reason (optional)",
            })}
          >
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("admin:cancelReasonPlaceholder", {
                defaultValue: "Add a note for the audit log",
              })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
