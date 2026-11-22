import { NextRequest, NextResponse } from "next/server";
import { serverGql } from "@/lib/server";

interface ResendResult {
  ok?: boolean;
  devOtp?: string | null;
  error?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { userId?: string };
  const userId = String(body.userId ?? "");
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Missing user" }, { status: 400 });
  }
  const r = await serverGql<ResendResult>(
    "ResendOtp",
    { userId, purpose: "login" },
    req,
  );
  return NextResponse.json({ ok: true, devOtp: r.data?.devOtp ?? null });
}
