"use client";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  getAccessToken,
  refreshSession,
  setAccessToken,
  subscribeAccessToken,
} from "@/lib/gql";
import { AdminUser, decodeUser, tokenExpiresInMs } from "@/lib/jwt";

interface AuthContextValue {
  user: AdminUser | null;
  ready: boolean;
  /** Called after a successful OTP verify with the in-memory access token. */
  setSession: (accessToken: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(false);

  const setSession = useCallback((accessToken: string) => {
    setAccessToken(accessToken);
    setUser(decodeUser(accessToken));
  }, []);

  const logout = useCallback(async () => {
    try {
      const token = getAccessToken();
      await fetch("/api/auth/logout", {
        method: "POST",
        // The backend needs it to end this session, not just the refresh token.
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    } catch {
      // ignore
    }
    setAccessToken(null);
    setUser(null);
    router.replace("/login");
  }, [router]);

  // Bootstrap: mint an access token from the httpOnly refresh cookie if present.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await refreshSession();
      if (cancelled) return;
      if (ok) setUser(decodeUser(getAccessToken()));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Stay in sync when a 401-driven refresh swaps the token under us.
  useEffect(
    () =>
      subscribeAccessToken((token) => {
        setUser(token ? decodeUser(token) : null);
      }),
    [],
  );

  // Proactively refresh shortly before the access token expires.
  useEffect(() => {
    if (!user) return;
    const ms = tokenExpiresInMs(getAccessToken());
    if (!ms) return;
    const delay = Math.max(5_000, ms - 60_000);
    const id = setTimeout(() => {
      void refreshSession();
    }, delay);
    return () => clearTimeout(id);
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, ready, setSession, logout }),
    [user, ready, setSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
