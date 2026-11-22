"use client";
import { Badge, type BadgeTone } from "./Badge";
import { statusLabel } from "@/lib/format";
import { useLocale } from "@/context/I18nProvider";

// Maps a backend status enum to a tone; the label comes from the shared
// `status:` i18n namespace (same keys as the mobile app).
const TONE_BY_STATUS: Record<string, BadgeTone> = {
  verified: "success",
  succeeded: "success",
  completed: "success",
  confirmed: "success",
  active: "success",
  in_progress: "info",
  scheduled: "info",
  pending: "warning",
  flagged: "warning",
  rejected: "danger",
  failed: "danger",
  cancelled: "danger",
  suspended: "danger",
  refunded: "neutral",
};

export function StatusBadge({ status }: { status?: string | null }) {
  const { t } = useLocale();
  if (!status) return null;
  const tone = TONE_BY_STATUS[status] ?? "neutral";
  return <Badge tone={tone}>{statusLabel(t, status)}</Badge>;
}
