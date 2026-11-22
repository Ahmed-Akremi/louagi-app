import { NextRequest, NextResponse } from "next/server";
import {
  serverGql,
  refreshCookieName,
  refreshCookieOptions,
} from "@/lib/server";
import { decodeUser, tokenExpiresInMs } from "@/lib/jwt";

// Step 2 of login: verify the OTP → backend returns the token pair. We stash the
// refresh token in an httpOnly cookie (never exposed to JS) and hand only the
// access token back to the browser, which keeps it in memory.
interface VerifyResult {
  ok?: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: { id: string; name?: string; role?: string };
  error?: string;
}

const DEFAULT_REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    userId?: string;
    otp?: string;
  };
  const userId = String(body.userId ?? "");
  const otp = String(body.otp ?? "");
  if (!userId || !otp) {
    return NextResponse.json(
      { ok: false, error: "Verification code is required" },
      { status: 400 },
    );
  }

  const r = await serverGql<VerifyResult>(
    "VerifyOtp",
    { userId, purpose: "login", otp },
    req,
  );
  const data = r.data;
  if (!data?.ok || !data.accessToken || !data.refreshToken) {
    return NextResponse.json(
      { ok: false, error: data?.error || r.error || "Verification failed" },
      { status: 400 },
    );
  }

  // This dashboard is admin-only. Reject any other role before establishing a
  // session (the backend still enforces admin on every operation regardless).
  const role = data.user?.role || decodeUser(data.accessToken)?.role;
  if (role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "This dashboard is for administrators only." },
      { status: 403 },
    );
  }

  const expMs = tokenExpiresInMs(data.refreshToken);
  const maxAge =
    expMs && expMs > 0 ? Math.floor(expMs / 1000) : DEFAULT_REFRESH_MAX_AGE;

  const res = NextResponse.json({ ok: true, accessToken: data.accessToken });
  res.cookies.set(
    refreshCookieName(),
    data.refreshToken,
    refreshCookieOptions(maxAge),
  );
  return res;
}
