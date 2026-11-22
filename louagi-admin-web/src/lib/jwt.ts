// Client-side decode of the access-token JWT to derive the current admin's
// identity for display. Authorization is ALWAYS enforced server-side per
// operation — this is purely for rendering name/role and gating the UI.
export interface AdminUser {
  id: string;
  name: string;
  role: string;
  driverStatus?: string | null;
  impersonatedBy?: string | null;
}

function b64urlDecode(input: string): string {
  let s = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  if (typeof atob === "function") return atob(s);
  // Node fallback (used in any server-side decode).
  return Buffer.from(s, "base64").toString("binary");
}

interface JwtClaims {
  sub?: string;
  name?: string;
  role?: string;
  driverStatus?: string | null;
  impersonatedBy?: string | null;
  exp?: number;
}

function claims(token: string): JwtClaims | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    return JSON.parse(b64urlDecode(part)) as JwtClaims;
  } catch {
    return null;
  }
}

export function decodeUser(token: string | null): AdminUser | null {
  if (!token) return null;
  const c = claims(token);
  if (!c?.sub) return null;
  return {
    id: c.sub,
    name: c.name || "Admin",
    role: c.role || "",
    driverStatus: c.driverStatus ?? null,
    impersonatedBy: c.impersonatedBy ?? null,
  };
}

export function tokenExpiresInMs(token: string | null): number | null {
  if (!token) return null;
  const c = claims(token);
  if (!c?.exp) return null;
  return c.exp * 1000 - Date.now();
}
