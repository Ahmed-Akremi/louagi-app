// Browser-side GraphQL dispatch — the web port of the mobile app's
// src/api/graphql.js. The access token lives in memory (never persisted); on a
// 401 we hit the same-origin BFF /api/auth/refresh, which reads the httpOnly
// refresh cookie, rotates it, and returns a fresh access token. Then we retry
// once.
import { API_URL } from "./config";

let accessToken: string | null = null;
const listeners = new Set<(token: string | null) => void>();

export function setAccessToken(token: string | null): void {
  accessToken = token;
  listeners.forEach((fn) => fn(token));
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function subscribeAccessToken(fn: (token: string | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export class GqlError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GqlError";
    this.status = status;
  }
}

const buildQuery = (op: string) =>
  `query ${op}($input: JSON) { ${op}(input: $input) }`;

// ─── Client security context ────────────────────────────────────────────────
// Sent as x-client-context on every request and recorded in the admin audit
// trail (see server/src/lib/clientContext.js for the accepting parser).
// Best-effort: any failure means the header is simply omitted.
const INSTALL_ID_KEY = "louagi.admin.install_id";

function installId(): string | null {
  try {
    let id = localStorage.getItem(INSTALL_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(INSTALL_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function browserLabel(ua: string): string | null {
  const rules: [string, RegExp][] = [
    ["Edge", /Edg\/(\d+)/],
    ["Opera", /OPR\/(\d+)/],
    ["Firefox", /Firefox\/(\d+)/],
    ["Chrome", /Chrome\/(\d+)/],
    ["Safari", /Version\/(\d+).*Safari/],
  ];
  for (const [name, re] of rules) {
    const m = ua.match(re);
    if (m) return `${name} ${m[1]}`;
  }
  return null;
}

function osLabel(ua: string): string | null {
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad/.test(ua)) return "iOS";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}

let clientContextValue: string | null | undefined;

function clientContextHeader(): string | null {
  if (typeof navigator === "undefined") return null;
  if (clientContextValue !== undefined) return clientContextValue;
  try {
    const ua = navigator.userAgent;
    clientContextValue = JSON.stringify({
      device: {
        id: installId(),
        platform: "web",
        os: osLabel(ua),
        browser: browserLabel(ua),
        screen: `${window.screen.width}x${window.screen.height}`,
        locale: navigator.language || null,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      },
      gps: null,
    });
  } catch {
    clientContextValue = null;
  }
  return clientContextValue;
}

interface PostResult {
  res: Response;
  payload: {
    data?: Record<string, unknown>;
    errors?: { message?: string }[];
  } | null;
}

async function post(
  operationName: string,
  variables: Record<string, unknown> | undefined,
  token: string | null,
): Promise<PostResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const clientContext = clientContextHeader();
  if (clientContext) headers["x-client-context"] = clientContext;
  const res = await fetch(`${API_URL}/graphql`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      operationName,
      variables: variables || {},
      query: buildQuery(operationName),
    }),
  });
  const payload = (await res.json().catch(() => null)) as PostResult["payload"];
  return { res, payload };
}

let pendingRefresh: Promise<boolean> | null = null;

export async function refreshSession(): Promise<boolean> {
  if (pendingRefresh) return pendingRefresh;
  pendingRefresh = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST" });
      if (!res.ok) {
        setAccessToken(null);
        return false;
      }
      const data = (await res.json().catch(() => null)) as
        | { accessToken?: string }
        | null;
      if (!data?.accessToken) {
        setAccessToken(null);
        return false;
      }
      setAccessToken(data.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      pendingRefresh = null;
    }
  })();
  return pendingRefresh;
}

export async function gql<T = unknown>(
  operationName: string,
  variables?: Record<string, unknown>,
  opts: { retry?: boolean } = {},
): Promise<T> {
  const retry = opts.retry ?? true;
  const { res, payload } = await post(operationName, variables, accessToken);

  if (res.status === 401 && retry) {
    const refreshed = await refreshSession();
    if (refreshed) return gql<T>(operationName, variables, { retry: false });
    throw new GqlError("Your session has expired. Please sign in again.", 401);
  }

  if (!res.ok) {
    throw new GqlError(
      payload?.errors?.[0]?.message || `Request failed (HTTP ${res.status})`,
      res.status,
    );
  }
  if (payload?.errors?.length) {
    throw new GqlError(payload.errors[0]?.message || "Request failed", res.status);
  }
  return (payload?.data?.[operationName] ?? null) as T;
}

export async function gqlList<T = unknown>(
  operationName: string,
  variables?: Record<string, unknown>,
): Promise<T[]> {
  const result = await gql<T[]>(operationName, variables);
  return Array.isArray(result) ? result : [];
}
