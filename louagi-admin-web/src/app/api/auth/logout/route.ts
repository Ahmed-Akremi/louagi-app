import { NextRequest, NextResponse } from "next/server";
import {
  serverGql,
  refreshCookieName,
  refreshCookieOptions,
} from "@/lib/server";

// Best-effort revoke the refresh token server-side, then always clear the cookie.
export async function POST(req: NextRequest) {
  const name = refreshCookieName();
  const token = req.cookies.get(name)?.value;
  if (token) {
    try {
      await serverGql("Logout", { refreshToken: token }, req);
    } catch {
      // ignore — we clear the cookie regardless
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(name, "", refreshCookieOptions(0));
  return res;
}
