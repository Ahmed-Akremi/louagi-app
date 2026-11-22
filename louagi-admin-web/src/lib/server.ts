// Server-only helpers for the BFF auth route handlers. NOT imported by client
// components. The refresh token lives in an httpOnly cookie on THIS origin and
// is exchanged server-side against the backend's Refresh operation.
import "server-only";

export function serverApiUrl(): string {
  return (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function refreshCookieName(): string {
  return process.env.REFRESH_COOKIE_NAME || "louagi_admin_rt";
}

export function cookieSecure(): boolean {
  return (
    process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production"
  );
}

// Options for the httpOnly refresh-token cookie. SameSite=Lax is fine because
// the cookie is only ever read by our own same-origin /api/auth/* routes.
export function refreshCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}

const GQL_QUERY = (op: string) =>
  `query ${op}($input: JSON) { ${op}(input: $input) }`;

// Minimal server-side GraphQL dispatch used by the BFF auth routes.
// Pass the incoming request so the browser's identity (IP via
// x-forwarded-for, user-agent, x-client-context fingerprint) is forwarded to
// the backend — otherwise auth audit entries would record this Next.js
// server as the client.
export async function serverGql<T = unknown>(
  operationName: string,
  variables: Record<string, unknown> = {},
  req?: Request,
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (req) {
    for (const name of ["x-client-context", "user-agent", "authorization"]) {
      const value = req.headers.get(name);
      if (value) headers[name] = value;
    }
    // Only the last hop comes from our proxy; earlier entries are client-supplied.
    const ip = req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
    if (ip) headers["x-forwarded-for"] = ip;
  }
  try {
    const res = await fetch(`${serverApiUrl()}/graphql`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        operationName,
        variables,
        query: GQL_QUERY(operationName),
      }),
      cache: "no-store",
    });
    const payload = (await res.json().catch(() => null)) as {
      data?: Record<string, T>;
      errors?: { message?: string }[];
    } | null;
    if (payload?.errors?.length) {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: payload.errors[0]?.message || "GraphQL error",
      };
    }
    return {
      ok: res.ok,
      status: res.status,
      data: (payload?.data?.[operationName] ?? null) as T | null,
    };
  } catch {
    return { ok: false, status: 502, data: null, error: "Network unavailable" };
  }
}
