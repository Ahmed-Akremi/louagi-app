"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LogOut,
  ShieldCheck,
  KeyRound,
  Monitor,
  Sun,
  Moon,
  Languages,
  ScrollText,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Field, Input } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { useAuth } from "@/context/AuthProvider";
import { useTheme } from "@/context/ThemeProvider";
import { useLocale } from "@/context/I18nProvider";
import { useToast } from "@/context/ToastProvider";
import {
  adminAuditCount,
  adminTotpStatus,
  adminSetupTotp,
  adminActivateTotp,
  adminDisableTotp,
} from "@/api/admin";
import type { TotpSetupResult } from "@/types/admin";

type Mode = "light" | "dark" | "system";

const THEME_OPTIONS: { value: Mode; icon: typeof Sun }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

export default function ProfilePage() {
  const { t, locale, locales, setLocale, labels } = useLocale();
  const { mode, setMode } = useTheme();
  const { user, logout } = useAuth();
  const { show } = useToast();
  const queryClient = useQueryClient();

  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<TotpSetupResult | null>(null);

  const auditCountQ = useQuery({
    queryKey: ["auditCount"],
    queryFn: adminAuditCount,
  });
  const totpQ = useQuery({
    queryKey: ["totpStatus"],
    queryFn: adminTotpStatus,
  });

  const setupMut = useMutation({
    mutationFn: adminSetupTotp,
    onSuccess: (res) => {
      if (res.ok) {
        setSetup(res);
      } else {
        show(
          res.error ?? t("errors:generic", { defaultValue: "Something went wrong" }),
          "error",
        );
      }
    },
    onError: (err: unknown) => {
      show(
        err instanceof Error
          ? err.message
          : t("errors:generic", { defaultValue: "Something went wrong" }),
        "error",
      );
    },
  });

  const activateMut = useMutation({
    mutationFn: (value: string) => adminActivateTotp(value),
    onSuccess: (res) => {
      if (res.ok) {
        show(
          t("admin:totpEnabledToast", { defaultValue: "Two-factor enabled" }),
          "success",
        );
        setSetup(null);
        setCode("");
        void queryClient.invalidateQueries({ queryKey: ["totpStatus"] });
      } else {
        show(
          res.error ?? t("errors:generic", { defaultValue: "Something went wrong" }),
          "error",
        );
      }
    },
    onError: (err: unknown) => {
      show(
        err instanceof Error
          ? err.message
          : t("errors:generic", { defaultValue: "Something went wrong" }),
        "error",
      );
    },
  });

  const disableMut = useMutation({
    mutationFn: (value: string) => adminDisableTotp(value),
    onSuccess: (res) => {
      if (res.ok) {
        show(
          t("admin:totpDisabledToast", { defaultValue: "Two-factor disabled" }),
          "success",
        );
        setCode("");
        void queryClient.invalidateQueries({ queryKey: ["totpStatus"] });
      } else {
        show(
          res.error ?? t("errors:generic", { defaultValue: "Something went wrong" }),
          "error",
        );
      }
    },
    onError: (err: unknown) => {
      show(
        err instanceof Error
          ? err.message
          : t("errors:generic", { defaultValue: "Something went wrong" }),
        "error",
      );
    },
  });

  const status = totpQ.data;
  const initial = user?.name?.trim()?.[0]?.toUpperCase() ?? "A";
  const maskedId = user?.id ? `${user.id.slice(0, 8)}…` : "—";
  const trimmedCode = code.trim();
  const codeValid = /^\d{6}$/.test(trimmedCode);

  return (
    <div>
      <PageHeader
        title={t("admin:profileTitle", { defaultValue: "Profile" })}
        subtitle={t("admin:secureSession", {
          defaultValue: "Account, security, and preferences",
        })}
        actions={
          <Button
            variant="outline"
            iconLeft={<LogOut className="h-4 w-4" />}
            onClick={() => {
              void logout();
            }}
          >
            {t("auth:signout", { defaultValue: "Sign out" })}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {/* Identity */}
        <Card>
          <CardHeader
            title={t("admin:identityTitle", { defaultValue: "Identity" })}
          />
          <CardBody className="space-y-5">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xl font-bold text-brand">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-text">
                  {user?.name ?? t("admin:administrator", { defaultValue: "Administrator" })}
                </p>
                <div className="mt-1">
                  <Badge tone="brand">
                    {t("admin:administrator", { defaultValue: "Administrator" })}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
              <span className="text-text-muted">
                {t("admin:userId", { defaultValue: "ID" })}
              </span>
              <span className="font-mono text-text">{maskedId}</span>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <span className="rounded-md bg-card-muted p-1.5 text-text-muted">
                <ScrollText className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                {auditCountQ.isLoading ? (
                  <Skeleton className="h-5 w-24" />
                ) : (
                  <p className="text-sm font-semibold text-text">
                    {formatNumber(auditCountQ.data ?? 0, locale)}{" "}
                    <span className="font-normal text-text-muted">
                      {t("admin:auditEntries", { defaultValue: "Audit entries" })}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Security — TOTP */}
        <Card>
          <CardHeader
            title={t("admin:totpTitle", { defaultValue: "Two-factor (TOTP)" })}
            action={
              status?.enabled ? (
                <Badge tone="success">
                  {t("admin:enforced", { defaultValue: "Enabled" })}
                </Badge>
              ) : undefined
            }
          />
          <CardBody className="space-y-4">
            <p className="text-xs text-text-muted">
              {t("admin:totpOffSubtitle", {
                defaultValue: "Add a second factor required for sensitive actions.",
              })}
            </p>

            {totpQ.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : totpQ.isError ? (
              <Banner
                variant="danger"
                title={t("errors:generic", { defaultValue: "Couldn't load status" })}
                action={
                  <Button size="sm" variant="outline" onClick={() => totpQ.refetch()}>
                    {t("common:retry", { defaultValue: "Retry" })}
                  </Button>
                }
              />
            ) : status?.enabled ? (
              <div className="space-y-3">
                <Field
                  label={t("admin:totpCodeLabel", { defaultValue: "6-digit code" })}
                  hint={t("admin:totpCodeHint", {
                    defaultValue: "Enter a current code to disable two-factor.",
                  })}
                >
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                </Field>
                <Button
                  variant="danger"
                  loading={disableMut.isPending}
                  disabled={!codeValid}
                  onClick={() => disableMut.mutate(trimmedCode)}
                >
                  {t("admin:totpDisable", { defaultValue: "Disable" })}
                </Button>
              </div>
            ) : setup ? (
              <div className="space-y-4">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-text-muted">
                    {t("admin:totpSecretTitle", { defaultValue: "Secret" })}
                  </p>
                  <div className="break-all rounded-md border border-border bg-card-muted px-3 py-2 font-mono text-sm text-text">
                    {setup.secret ?? "—"}
                  </div>
                  {setup.uri ? (
                    <p className="mt-1.5 break-all text-[11px] text-text-muted">
                      {setup.uri}
                    </p>
                  ) : null}
                </div>
                <Field
                  label={t("admin:totpCodeLabel", { defaultValue: "6-digit code" })}
                >
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                </Field>
                <Button
                  variant="primary"
                  iconLeft={<ShieldCheck className="h-4 w-4" />}
                  loading={activateMut.isPending}
                  disabled={!codeValid}
                  onClick={() => activateMut.mutate(trimmedCode)}
                >
                  {t("admin:totpActivate", { defaultValue: "Activate" })}
                </Button>
              </div>
            ) : (
              <Button
                variant="primary"
                iconLeft={<KeyRound className="h-4 w-4" />}
                loading={setupMut.isPending}
                onClick={() => setupMut.mutate()}
              >
                {t("admin:totpSetup", { defaultValue: "Set up" })}
              </Button>
            )}
          </CardBody>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader
            title={t("admin:preferencesTitle", { defaultValue: "Preferences" })}
          />
          <CardBody className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-medium text-text-muted">
                {t("admin:theme", { defaultValue: "Theme" })}
              </p>
              <div className="flex flex-wrap gap-2">
                {THEME_OPTIONS.map(({ value, icon: Icon }) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={mode === value ? "primary" : "outline"}
                    iconLeft={<Icon className="h-4 w-4" />}
                    onClick={() => setMode(value)}
                  >
                    {value === "light"
                      ? t("admin:themeLight", { defaultValue: "Light" })
                      : value === "dark"
                        ? t("admin:themeDark", { defaultValue: "Dark" })
                        : t("admin:themeSystem", { defaultValue: "System" })}
                  </Button>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted">
                <Languages className="h-3.5 w-3.5" />
                {t("admin:language", { defaultValue: "Language" })}
              </p>
              <div className="flex flex-wrap gap-2">
                {locales.map((l) => (
                  <Button
                    key={l}
                    size="sm"
                    variant={l === locale ? "primary" : "outline"}
                    className={cn(l === locale && "font-semibold")}
                    onClick={() => setLocale(l)}
                  >
                    {labels[l]}
                  </Button>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
