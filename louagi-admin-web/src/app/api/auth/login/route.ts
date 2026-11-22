import { NextRequest, NextResponse } from "next/server";
import { serverGql } from "@/lib/server";

// Step 1 of login: phone + password → backend sends an OTP. No tokens yet.
interface StartLoginResult {
  ok?: boolean;
  userId?: string;
  devOtp?: string | null;
  error?: string;
  lockedUntil?: number;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    phone?: string;
    password?: string;
  };
  const phone = String(body.phone ?? "").trim();
  const password = String(body.password ?? "");
  if (!phone || !password) {
    return NextResponse.json(
      { ok: false, error: "Phone and password are required" },
      { status: 400 },
    );
  }

  const r = await serverGql<StartLoginResult>("StartLogin", { phone, password }, req);
  const data = r.data;
  if (!data?.ok || !data.userId) {
    return NextResponse.json(
      {
        ok: false,
        error: data?.error || r.error || "Login failed",
        lockedUntil: data?.lockedUntil ?? null,
      },
      { status: r.status === 429 ? 429 : 401 },
    );
  }

  // devOtp is only returned by the backend in development; surfaced so the
  // dashboard can show it without an SMS provider configured.
  return NextResponse.json({
    ok: true,
    userId: data.userId,
    devOtp: data.devOtp ?? null,
  });
}
