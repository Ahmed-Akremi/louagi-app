"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Send, Users as UsersIcon, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { TableWrap, Table, Th, Td, Tr } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatDateTime, maskPhone } from "@/lib/format";
import { useLocale } from "@/context/I18nProvider";
import { useToast } from "@/context/ToastProvider";
import {
  adminSearchUsers,
  adminRecipientCount,
  adminSendNotification,
  adminListCampaigns,
} from "@/api/admin";
import type { AdminUser, AudienceType } from "@/types/admin";

const AUDIENCES: { value: AudienceType; key: string; fb: string }[] = [
  { value: "all", key: "admin:audienceEveryone", fb: "Everyone" },
  { value: "drivers", key: "admin:audienceDrivers", fb: "All drivers" },
  { value: "passengers", key: "admin:audiencePassengers", fb: "All passengers" },
  { value: "verified_drivers", key: "admin:audienceVerifiedDrivers", fb: "Verified drivers" },
  { value: "single", key: "admin:audienceSingle", fb: "Single user" },
];

export default function BroadcastPage() {
  return (
    <Suspense fallback={null}>
      <BroadcastInner />
    </Suspense>
  );
}

function BroadcastInner() {
  const { t, locale } = useLocale();
  const toast = useToast();
  const queryClient = useQueryClient();
  const params = useSearchParams();

  const [audience, setAudience] = useState<AudienceType>("all");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Single-user picker search.
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(id);
  }, [q]);

  // Preselect a user when arriving from the Users page "Notify" action.
  useEffect(() => {
    const uid = params.get("userId");
    const name = params.get("name");
    if (uid) {
      setAudience("single");
      setSelectedUser({
        id: uid,
        full_name: name ?? uid,
        email: "",
        role: "passenger",
        is_active: true,
      });
    }
  }, [params]);

  const searchQ = useQuery({
    queryKey: ["broadcastUserSearch", debouncedQ],
    queryFn: () => adminSearchUsers(debouncedQ),
    enabled: audience === "single" && !selectedUser && debouncedQ.length > 0,
  });

  const countQ = useQuery({
    queryKey: ["recipientCount", audience, selectedUser?.id ?? null],
    queryFn: () => adminRecipientCount(audience, selectedUser?.id ?? null),
    enabled: audience !== "single" || !!selectedUser,
  });

  const campaignsQ = useQuery({
    queryKey: ["adminCampaigns"],
    queryFn: () => adminListCampaigns(50),
  });

  const sendM = useMutation({
    mutationFn: () =>
      adminSendNotification({
        audience,
        userId: audience === "single" ? selectedUser?.id ?? null : null,
        title: title.trim(),
        body: body.trim(),
        data: link.trim() ? { screen: link.trim() } : undefined,
      }),
    onSuccess: (res) => {
      setConfirmOpen(false);
      if (res.ok) {
        toast.show(
          t("admin:broadcastSent", {
            defaultValue: `Sent to ${res.recipientCount ?? 0} · ${res.pushed ?? 0} pushed`,
            recipients: res.recipientCount ?? 0,
            pushed: res.pushed ?? 0,
          }),
          "success",
        );
        setTitle("");
        setBody("");
        setLink("");
        void queryClient.invalidateQueries({ queryKey: ["adminCampaigns"] });
      } else {
        toast.show(
          res.error ?? t("errors:generic", { defaultValue: "Something went wrong" }),
          "error",
        );
      }
    },
    onError: () =>
      toast.show(t("errors:generic", { defaultValue: "Something went wrong" }), "error"),
  });

  const recipientCount = audience === "single" ? (selectedUser ? 1 : 0) : countQ.data?.count ?? 0;
  const canSend =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (audience !== "single" || !!selectedUser) &&
    recipientCount > 0;

  const campaigns = campaignsQ.data ?? [];
  const searchResults = useMemo(() => searchQ.data ?? [], [searchQ.data]);

  return (
    <div>
      <PageHeader
        title={t("admin:broadcastTitle", { defaultValue: "Broadcast notification" })}
        subtitle={t("admin:broadcastSubtitle", {
          defaultValue: "Send a push notification to app users",
        })}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Composer */}
        <Card className="xl:col-span-2">
          <CardHeader title={t("admin:broadcastTitle", { defaultValue: "Broadcast notification" })} />
          <CardBody className="space-y-5">
            {/* Audience */}
            <div>
              <span className="mb-1.5 block text-xs font-medium text-text-muted">
                {t("admin:audience", { defaultValue: "Audience" })}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {AUDIENCES.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => {
                      setAudience(a.value);
                      if (a.value !== "single") setSelectedUser(null);
                    }}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                      audience === a.value
                        ? "bg-navy text-white dark:bg-navy/20 dark:text-navy"
                        : "bg-card-muted text-text-muted hover:text-text",
                    )}
                  >
                    {t(a.key, { defaultValue: a.fb })}
                  </button>
                ))}
              </div>
            </div>

            {/* Single-user picker */}
            {audience === "single" ? (
              <div>
                {selectedUser ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-text">
                        {selectedUser.full_name}
                      </div>
                      {selectedUser.email ? (
                        <div className="truncate text-xs text-text-muted">
                          {selectedUser.email}
                        </div>
                      ) : null}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedUser(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Field label={t("admin:selectUser", { defaultValue: "Select a user" })}>
                    <div className="relative">
                      <Search className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                      <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={t("admin:searchUser", {
                          defaultValue: "Search by name, phone or email",
                        })}
                        className="ps-9"
                      />
                    </div>
                    {searchResults.length > 0 ? (
                      <ul className="scrollbar-thin mt-2 max-h-48 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                        {searchResults.map((u) => (
                          <li key={u.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUser(u);
                                setQ("");
                              }}
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-card-muted"
                            >
                              <span className="truncate text-text">{u.full_name}</span>
                              <span className="shrink-0 text-xs text-text-muted">
                                {maskPhone(u.phone_number)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </Field>
                )}
              </div>
            ) : null}

            <Field label={t("admin:notifTitle", { defaultValue: "Title" })}>
              <Input
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Louagi"
              />
            </Field>
            <Field label={t("admin:notifBody", { defaultValue: "Message" })}>
              <Textarea
                value={body}
                rows={4}
                maxLength={500}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t("admin:notifBody", { defaultValue: "Message" })}
              />
            </Field>
            <Field
              label={t("admin:notifLink", { defaultValue: "Deep link (optional)" })}
              hint="e.g. Rides, Notifications"
            >
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Rides" />
            </Field>

            <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
              <span className="text-sm text-text-muted">
                {t("admin:recipientsCount", {
                  defaultValue: `${recipientCount} recipients`,
                  count: recipientCount,
                })}
              </span>
              <Button
                variant="secondary"
                iconLeft={<Send className="h-4 w-4" />}
                disabled={!canSend}
                onClick={() => setConfirmOpen(true)}
              >
                {t("admin:sendNow", { defaultValue: "Send notification" })}
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* History */}
        <Card>
          <CardHeader title={t("admin:campaignHistory", { defaultValue: "Recent broadcasts" })} />
          <CardBody className="p-0">
            {campaignsQ.isLoading ? (
              <div className="p-4">
                <SkeletonRows rows={4} />
              </div>
            ) : campaigns.length === 0 ? (
              <EmptyState
                icon={<Send className="h-7 w-7" />}
                title={t("admin:noBroadcasts", { defaultValue: "No broadcasts yet." })}
              />
            ) : (
              <ul className="scrollbar-thin max-h-128 divide-y divide-border overflow-y-auto">
                {campaigns.map((c) => (
                  <li key={c.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-medium text-text">{c.title}</span>
                      <Badge tone="neutral">{c.audience?.type ?? "all"}</Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">{c.body}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-text-muted">
                      <span>
                        {t("admin:recipients", { defaultValue: "Recipients" })}: {c.recipient_count}
                      </span>
                      <span className="text-success">
                        {t("admin:pushed", { defaultValue: "Pushed" })}: {c.pushed_count}
                      </span>
                      {c.failed_count > 0 ? (
                        <span className="text-danger">
                          {t("admin:failed", { defaultValue: "Failed" })}: {c.failed_count}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-[11px] text-text-muted">
                      {formatDateTime(c.created_at, locale)}
                      {c.sent_by_name ? ` · ${c.sent_by_name}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => {
          if (!sendM.isPending) setConfirmOpen(false);
        }}
        title={t("admin:confirmSendTitle", { defaultValue: "Confirm send" })}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={sendM.isPending}
            >
              {t("common:cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button variant="secondary" loading={sendM.isPending} onClick={() => sendM.mutate()}>
              {t("admin:sendNow", { defaultValue: "Send notification" })}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text">
          {t("admin:confirmSendBody", {
            defaultValue: `This will notify ${recipientCount} user(s). Continue?`,
            count: recipientCount,
          })}
        </p>
        <div className="mt-3 rounded-lg border border-border bg-card-muted p-3">
          <p className="text-sm font-semibold text-text">{title}</p>
          <p className="mt-0.5 text-sm text-text-muted">{body}</p>
        </div>
      </Modal>
    </div>
  );
}
