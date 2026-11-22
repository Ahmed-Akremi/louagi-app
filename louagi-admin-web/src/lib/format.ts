// Locale-aware formatting, ported/adapted from the mobile app's
// src/i18n/format.js. `statusLabel` maps a backend enum to the `status`
// i18n namespace (snake_case → camelCase key), falling back to the raw value.
type T = (key: string, opts?: Record<string, unknown>) => string;

const LOCALE_MAP: Record<string, string> = {
  en: "en-GB",
  fr: "fr-FR",
  ar: "ar-TN",
};

function intlLocale(locale?: string): string {
  return LOCALE_MAP[locale ?? "en"] ?? "en-GB";
}

export function statusLabel(t: T, status?: string | null): string {
  if (!status) return "";
  const key = String(status).replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
  return t(`status:${key}`, { defaultValue: String(status) });
}

export function formatDate(
  value?: string | number | Date | null,
  locale?: string,
  opts: { time?: boolean } = {},
): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      dateStyle: "medium",
      ...(opts.time ? { timeStyle: "short" } : {}),
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function formatDateTime(
  value?: string | number | Date | null,
  locale?: string,
): string {
  return formatDate(value, locale, { time: true });
}

// Fares/revenue are in Tunisian dinar. The mobile app renders "12.50 TND".
export function formatMoney(amount?: number | null, locale?: string): string {
  const n = Number(amount ?? 0);
  try {
    return `${new Intl.NumberFormat(intlLocale(locale), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)} TND`;
  } catch {
    return `${n.toFixed(2)} TND`;
  }
}

export function formatNumber(value?: number | null, locale?: string): string {
  const n = Number(value ?? 0);
  try {
    return new Intl.NumberFormat(intlLocale(locale)).format(n);
  } catch {
    return String(n);
  }
}

// Light PII masking for tables (the backend already returns decrypted values
// only to admins; this keeps shoulder-surfing down in dense lists).
export function maskPhone(phone?: string | null): string {
  if (!phone) return "—";
  const digits = String(phone).replace(/\s+/g, "");
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}••••${digits.slice(-2)}`;
}

export function relativeTime(value?: string | number | Date | null): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  const sec = Math.round((Date.now() - date.getTime()) / 1000);
  if (Number.isNaN(sec)) return "—";
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  return `${days}d ago`;
}
