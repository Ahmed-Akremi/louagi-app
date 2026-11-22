import { NextRequest, NextResponse } from "next/server";
import {
  serverGql,
  refreshCookieName,
  refreshCookieOptions,
} from "@/lib/server";
import { tokenExpiresInMs } from "@/lib/jwt";

// Reads the httpOnly refresh cookie, exchanges it for a fresh access token via
// the backend Refresh op, and rotates the cookie. Returns ONLY the access token
// to the browser. Used both on a 401 retry and to bootstrap a session on load.
interface RefreshResult {
  ok?: boolean;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

const DEFAULT_REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(req: NextRequest) {
  const name = refreshCookieName();
  const token = req.cookies.get(name)?.value;
  if (!token) {
    // No refresh cookie at all → the visitor simply isn't signed in yet. This is
    // the normal unauthenticated bootstrap state (AuthProvider probes /refresh on
    // every load), not an auth *failure*, so return 200 to avoid a misleading
    // "401 (Unauthorized)" in the console on each fresh visit. refreshSession()
    // treats "no accessToken in the body" as not-signed-in regardless of status,
    // so behavior is unchanged. A present-but-rejected cookie still returns 401
    // below, since that IS a real failure worth surfacing.
    return NextResponse.json({ ok: false, reason: "no_session" }, { status: 200 });
  }

  const r = await serverGql<RefreshResult>("Refresh", { refreshToken: token }, req);
  const data = r.data;
  if (!data?.ok || !data.accessToken || !data.refreshToken) {
    // Refresh token is invalid/revoked — clear the cookie so the client logs out.
    const res = NextResponse.json(
      { ok: false, error: data?.error || "Session expired" },
      { status: 401 },
    );
    res.cookies.set(name, "", refreshCookieOptions(0));
    return res;
  }

  const expMs = tokenExpiresInMs(data.refreshToken);
  const maxAge =
    expMs && expMs > 0 ? Math.floor(expMs / 1000) : DEFAULT_REFRESH_MAX_AGE;

  const res = NextResponse.json({ ok: true, accessToken: data.accessToken });
  res.cookies.set(name, data.refreshToken, refreshCookieOptions(maxAge));
  return res;
}
