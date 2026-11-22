"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { KpiTile } from "@/components/ui/KpiTile";
import { Badge } from "@/components/ui/Badge";
import { TableWrap, Table, Th, Td, Tr } from "@/components/ui/Table";
import { Field, Input } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { formatDateTime } from "@/lib/format";
import { useLocale } from "@/context/I18nProvider";
import { adminListAudit, adminAuditCount } from "@/api/admin";
import type { AuditEntry } from "@/types/admin";

interface ClientMeta {
  ipGeo?: { country?: string | null; city?: string | null; ll?: number[] | null } | null;
  gps?: { lat?: number; lon?: number; acc?: number | null; at?: string | null } | null;
  device?: {
    id?: string;
    platform?: string;
    os?: string;
    model?: string;
    appVersion?: string;
    browser?: string;
  } | null;
  ua?: string | null;
}

function clientMeta(metadata: Record<string, unknown> | null | undefined): ClientMeta | null {
  const client = metadata?.client;
  return client && typeof client === "object" ? (client as ClientMeta) : null;
}

function metadataSnippet(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null;
  // client is rendered in its own Device/Location columns.
  const { client: _client, ...rest } = metadata;
  if (Object.keys(rest).length === 0) return null;
  const json = JSON.stringify(rest);
  return json.length > 60 ? `${json.slice(0, 60)}…` : json;
}

function deviceLabel(client: ClientMeta | null): string | null {
  const d = client?.device;
  if (!d) return null;
  const parts = [
    d.model || d.browser,
    d.os,
    d.appVersion ? `v${d.appVersion}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

// Rough surface distance, good enough for a same-city vs another-country check.
function kmBetween(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const x = (bLon - aLon) * rad * Math.cos(((aLat + bLat) / 2) * rad);
  const y = (bLat - aLat) * rad;
  return Math.sqrt(x * x + y * y) * 6371;
}

const GEO_MISMATCH_KM = 100;

function locationInfo(client: ClientMeta | null): { label: string; mismatch: boolean } | null {
  if (!client) return null;
  const geo = client.ipGeo;
  const gps = client.gps;
  const label = geo?.country
    ? `${geo.city ?? "?"}, ${geo.country}`
    : typeof gps?.lat === "number" && typeof gps?.lon === "number"
      ? `${gps.lat.toFixed(2)}, ${gps.lon.toFixed(2)}`
      : null;
  if (!label) return null;
  const mismatch =
    typeof gps?.lat === "number" &&
    typeof gps?.lon === "number" &&
    Array.isArray(geo?.ll) &&
    geo.ll.length === 2 &&
    kmBetween(gps.lat, gps.lon, geo.ll[0], geo.ll[1]) > GEO_MISMATCH_KM;
  return { label, mismatch };
}

export default function AuditPage() {
  const { t, locale } = useLocale();

  const [actionType, setActionType] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(actionType.trim()), 300);
    return () => clearTimeout(handle);
  }, [actionType]);

  const countQ = useQuery({
    queryKey: ["auditCount"],
    queryFn: adminAuditCount,
  });

  const auditQ = useQuery({
    queryKey: ["audit", debounced],
    queryFn: () => adminListAudit({ actionType: debounced || undefined }),
  });

  const rows: AuditEntry[] = auditQ.data?.rows ?? [];
  const total = auditQ.data?.total ?? 0;

  return (
    <div>
      <PageHeader
        title={t("admin:auditLog", { defaultValue: "Audit log" })}
        subtitle={t("admin:auditLogSubtitle", {
          defaultValue: "Immutable record of administrative actions",
        })}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Banner
          variant="info"
          title={t("admin:tamperResistantTitle", {
            defaultValue: "Tamper-resistant",
          })}
          body={t("admin:tamperResistantBody", {
            defaultValue: "This append-only log cannot be edited or deleted.",
          })}
        />
        <KpiTile
          label={t("admin:auditEntries", { defaultValue: "Audit entries" })}
          value={
            countQ.isLoading
              ? "…"
              : countQ.isError
                ? "—"
                : new Intl.NumberFormat(
                    locale === "ar" ? "ar-TN" : locale === "fr" ? "fr-FR" : "en-GB",
                  ).format(countQ.data ?? 0)
          }
          icon={<ShieldCheck className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 max-w-md">
        <Field
          label={t("admin:filterByAction", { defaultValue: "Action type" })}
        >
          <Input
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            placeholder={t("admin:filterByActionPlaceholder", {
              defaultValue: "Filter by action (e.g. payment.refund.full)",
            })}
          />
        </Field>
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader
          title={t("admin:auditLog", { defaultValue: "Audit log" })}
          subtitle={t("admin:showingOf", {
            defaultValue: `Showing ${rows.length} of ${total}`,
            count: rows.length,
            total,
          })}
        />
        {auditQ.isLoading ? (
          <SkeletonRows rows={8} />
        ) : auditQ.isError ? (
          <div className="p-4">
            <Banner
              variant="danger"
              title={t("errors:generic", {
                defaultValue: "Couldn't load audit log",
              })}
            />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="h-7 w-7" />}
            title={t("admin:auditLog", { defaultValue: "No audit entries" })}
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>{t("admin:when", { defaultValue: "When" })}</Th>
                  <Th>{t("admin:actor", { defaultValue: "Actor" })}</Th>
                  <Th>{t("admin:action", { defaultValue: "Action" })}</Th>
                  <Th>{t("admin:target", { defaultValue: "Target" })}</Th>
                  <Th>{t("admin:ip", { defaultValue: "IP" })}</Th>
                  <Th>{t("admin:device", { defaultValue: "Device" })}</Th>
                  <Th>{t("admin:location", { defaultValue: "Location" })}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry, index) => {
                  const snippet = metadataSnippet(entry.metadata);
                  const client = clientMeta(entry.metadata);
                  const device = deviceLabel(client);
                  const location = locationInfo(client);
                  const target = `${entry.target_entity ?? ""} ${
                    entry.target_id ? `${entry.target_id.slice(0, 8)}…` : ""
                  }`.trim();
                  return (
                    <Tr key={entry.id ?? `${entry.created_at}-${index}`}>
                      <Td className="whitespace-nowrap text-text-muted">
                        {formatDateTime(entry.created_at, locale)}
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <Badge
                            tone={entry.actor_role === "admin" ? "brand" : "neutral"}
                          >
                            {entry.actor_role ??
                              t("admin:anonActor", { defaultValue: "system" })}
                          </Badge>
                          <span className="font-mono text-xs text-text-muted">
                            {entry.actor_id
                              ? `${entry.actor_id.slice(0, 8)}…`
                              : t("admin:anonActor", { defaultValue: "system" })}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <span className="font-mono text-xs">{entry.action}</span>
                        {snippet ? (
                          <p className="mt-0.5 font-mono text-[11px] text-text-muted">
                            {snippet}
                          </p>
                        ) : null}
                      </Td>
                      <Td className="whitespace-nowrap font-mono text-xs text-text-muted">
                        {target || "—"}
                      </Td>
                      <Td className="whitespace-nowrap text-text-muted">
                        {entry.ip ?? "—"}
                      </Td>
                      <Td
                        className="whitespace-nowrap text-xs text-text-muted"
                        title={client?.ua ?? undefined}
                      >
                        {device ?? "—"}
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-text-muted">
                        {location ? (
                          <span
                            title={
                              location.mismatch
                                ? t("admin:geoMismatch", {
                                    defaultValue:
                                      "Reported GPS is far from the IP location",
                                  })
                                : undefined
                            }
                          >
                            {location.label}
                            {location.mismatch ? " ⚠" : ""}
                          </span>
                        ) : (
                          "—"
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
