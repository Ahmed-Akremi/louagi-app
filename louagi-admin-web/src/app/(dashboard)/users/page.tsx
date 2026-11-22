"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Users as UsersIcon, Send } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { TableWrap, Table, Th, Td, Tr } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Field, Input } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { maskPhone } from "@/lib/format";
import { useLocale } from "@/context/I18nProvider";
import { useToast } from "@/context/ToastProvider";
import {
  adminSearchUsers,
  adminSetUserActive,
  adminImpersonate,
} from "@/api/admin";
import type { AdminUser } from "@/types/admin";

function roleTone(role: AdminUser["role"]): BadgeTone {
  if (role === "admin") return "brand";
  if (role === "driver") return "info";
  return "neutral";
}

export default function UsersPage() {
  const { t } = useLocale();
  const toast = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [impersonateTarget, setImpersonateTarget] = useState<AdminUser | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(timer);
  }, [q]);

  const usersQ = useQuery({
    queryKey: ["adminUsers", debouncedQ],
    queryFn: () => adminSearchUsers(debouncedQ),
    placeholderData: (prev) => prev,
  });

  const activeM = useMutation({
    mutationFn: (vars: { userId: string; active: boolean }) =>
      adminSetUserActive(vars.userId, vars.active),
    onSuccess: (res, vars) => {
      if (res.ok) {
        toast.show(
          vars.active
            ? t("toast:userReactivated", { defaultValue: "User reactivated" })
            : t("toast:userSuspended", { defaultValue: "User suspended" }),
          "success",
        );
        void queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
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

  const impersonateM = useMutation({
    mutationFn: (vars: { userId: string; code: string }) =>
      adminImpersonate(vars.userId, vars.code),
    onSuccess: (res) => {
      if (res.ok) {
        toast.show(
          t("admin:impersonationIssued", {
            defaultValue: `Impersonation session issued for ${res.target?.full_name ?? ""}`,
            name: res.target?.full_name ?? "",
          }),
          "success",
        );
        closeImpersonate();
      } else {
        setMfaError(
          res.error ??
            t("errors:generic", { defaultValue: "Something went wrong" }),
        );
      }
    },
    onError: () => {
      setMfaError(t("errors:generic", { defaultValue: "Something went wrong" }));
    },
  });

  function openImpersonate(user: AdminUser) {
    setCode("");
    setMfaError(null);
    setImpersonateTarget(user);
  }

  function closeImpersonate() {
    if (impersonateM.isPending) return;
    setImpersonateTarget(null);
    setCode("");
    setMfaError(null);
  }

  function confirmImpersonate() {
    if (!impersonateTarget) return;
    setMfaError(null);
    impersonateM.mutate({
      userId: impersonateTarget.id,
      code: code.trim(),
    });
  }

  const users = usersQ.data ?? [];

  return (
    <div>
      <PageHeader
        title={t("admin:userManagement", { defaultValue: "User management" })}
        subtitle={t("admin:userManagementSubtitle", {
          defaultValue: "Search, suspend, and manage accounts",
        })}
      />

      <div className="mb-4 max-w-md">
        <Field>
          <div className="relative">
            <Search className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("admin:searchPlaceholder", {
                defaultValue: "Search by name, phone, or email",
              })}
              className="ps-9"
            />
          </div>
        </Field>
      </div>

      <Card className="overflow-hidden">
        {usersQ.isLoading ? (
          <SkeletonRows rows={6} />
        ) : usersQ.isError ? (
          <div className="p-4">
            <Banner
              variant="danger"
              title={t("errors:generic", {
                defaultValue: "Couldn't load users",
              })}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => usersQ.refetch()}
                >
                  {t("common:retry", { defaultValue: "Retry" })}
                </Button>
              }
            />
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<UsersIcon className="h-7 w-7" />}
            title={t("admin:searchUsers", { defaultValue: "No users found" })}
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>{t("admin:user", { defaultValue: "User" })}</Th>
                  <Th>{t("admin:contact", { defaultValue: "Contact" })}</Th>
                  <Th>{t("admin:role", { defaultValue: "Role" })}</Th>
                  <Th>{t("admin:status", { defaultValue: "Status" })}</Th>
                  <Th className="text-end">
                    {t("admin:actions", { defaultValue: "Actions" })}
                  </Th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const pending =
                    activeM.isPending &&
                    activeM.variables?.userId === user.id;
                  return (
                    <Tr key={user.id}>
                      <Td className="font-medium">{user.full_name}</Td>
                      <Td>
                        <div className="truncate">{user.email}</div>
                        <div className="text-xs text-text-muted">
                          {maskPhone(user.phone_number)}
                        </div>
                      </Td>
                      <Td>
                        <Badge tone={roleTone(user.role)}>{user.role}</Badge>
                      </Td>
                      <Td>
                        {user.is_active ? (
                          <Badge tone="success">
                            {t("admin:active", { defaultValue: "Active" })}
                          </Badge>
                        ) : (
                          <Badge tone="danger">
                            {t("admin:suspended", {
                              defaultValue: "Suspended",
                            })}
                          </Badge>
                        )}
                      </Td>
                      <Td className="text-end">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            iconLeft={<Send className="h-3.5 w-3.5" />}
                            onClick={() =>
                              router.push(
                                `/broadcast?userId=${encodeURIComponent(user.id)}&name=${encodeURIComponent(user.full_name)}`,
                              )
                            }
                          >
                            {t("admin:notify", { defaultValue: "Notify" })}
                          </Button>
                          {user.role !== "admin" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openImpersonate(user)}
                            >
                              {t("admin:impersonate", {
                                defaultValue: "Impersonate",
                              })}
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant={user.is_active ? "outline" : "primary"}
                            loading={pending}
                            onClick={() =>
                              activeM.mutate({
                                userId: user.id,
                                active: !user.is_active,
                              })
                            }
                          >
                            {user.is_active
                              ? t("admin:suspend", { defaultValue: "Suspend" })
                              : t("admin:reactivate", {
                                  defaultValue: "Reactivate",
                                })}
                          </Button>
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

      <Modal
        open={impersonateTarget !== null}
        onClose={closeImpersonate}
        title={t("admin:impersonate", { defaultValue: "Impersonate" })}
        footer={
          <>
            <Button
              variant="outline"
              onClick={closeImpersonate}
              disabled={impersonateM.isPending}
            >
              {t("common:cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              variant="primary"
              loading={impersonateM.isPending}
              onClick={confirmImpersonate}
            >
              {t("common:confirm", { defaultValue: "Confirm" })}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Banner
            variant="warning"
            title={t("admin:sensitiveActionsTitle", {
              defaultValue: "Step-up verification",
            })}
            body={t("admin:sensitiveActionsBody", {
              defaultValue:
                "This action requires a step-up code and is audited.",
            })}
          />
          {impersonateTarget ? (
            <p className="text-sm text-text-muted">
              {`${impersonateTarget.full_name} · ${impersonateTarget.email}`}
            </p>
          ) : null}
          <Field
            label={t("admin:stepUpCode", { defaultValue: "Step-up code" })}
            error={mfaError ?? undefined}
          >
            <Input
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
                if (mfaError) setMfaError(null);
              }}
              placeholder="000000"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
