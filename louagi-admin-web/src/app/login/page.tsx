"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { useAuth } from "@/context/AuthProvider";
import { useLocale } from "@/context/I18nProvider";

export default function LoginPage() {
  const router = useRouter();
  const { setSession, user, ready } = useAuth();
  const { t } = useLocale();

  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [userId, setUserId] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already signed in (e.g. valid refresh cookie) → skip the form.
  useEffect(() => {
    if (ready && user?.role === "admin") router.replace("/overview");
  }, [ready, user, router]);

  async function submitCredentials(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || t("errors:generic", { defaultValue: "Login failed" }));
        return;
      }
      setUserId(data.userId);
      setDevOtp(data.devOtp ?? null);
      setStep("otp");
    } catch {
      setError(t("errors:network", { defaultValue: "Network error" }));
    } finally {
      setLoading(false);
    }
  }

  async function submitOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, otp }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.accessToken) {
        setError(
          data.error || t("errors:generic", { defaultValue: "Verification failed" }),
        );
        return;
      }
      setSession(data.accessToken);
      router.replace("/overview");
    } catch {
      setError(t("errors:network", { defaultValue: "Network error" }));
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    try {
      const res = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      setDevOtp(data.devOtp ?? null);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo size={48} className="rounded-xl shadow-card" />
          <h1 className="text-lg font-bold text-text">Louagi Admin</h1>
          <p className="text-sm text-text-muted">
            {t("admin:secureSession", {
              defaultValue: "Secure administrator access",
            })}
          </p>
        </div>

        <Card>
          <CardBody>
            {step === "credentials" ? (
              <form onSubmit={submitCredentials} className="space-y-4">
                <Field
                  label={t("auth:phoneNumber", { defaultValue: "Phone number" })}
                >
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="username"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+216 .. ... ..."
                    autoFocus
                  />
                </Field>
                <Field label={t("auth:password", { defaultValue: "Password" })}>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("auth:yourPassword", {
                      defaultValue: "Your password",
                    })}
                  />
                </Field>
                {error ? <p className="text-xs text-danger">{error}</p> : null}
                <Button type="submit" className="w-full" loading={loading}>
                  {t("common:continue", { defaultValue: "Continue" })}
                </Button>
              </form>
            ) : (
              <form onSubmit={submitOtp} className="space-y-4">
                <p className="text-sm text-text-muted">
                  {t("auth:verifyPhoneSubtitle", {
                    defaultValue: "Enter the 6-digit code we sent you.",
                    phone: phone.replace(/\D/g, ""),
                  })}
                </p>
                {devOtp ? (
                  <Banner
                    variant="warning"
                    title={t("auth:devModeTitle", { defaultValue: "Dev mode" })}
                    body={t("auth:devModeBody", {
                      defaultValue: `Code: ${devOtp}`,
                      code: devOtp,
                    })}
                  />
                ) : null}
                <Field
                  label={t("auth:verify", { defaultValue: "Verification code" })}
                >
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    autoFocus
                    className="text-center tracking-[0.5em]"
                  />
                </Field>
                {error ? <p className="text-xs text-danger">{error}</p> : null}
                <Button
                  type="submit"
                  className="w-full"
                  loading={loading}
                  disabled={otp.length !== 6}
                >
                  {t("auth:verify", { defaultValue: "Verify" })}
                </Button>
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    className="text-text-muted hover:text-text"
                    onClick={() => {
                      setStep("credentials");
                      setError(null);
                    }}
                  >
                    {t("common:back", { defaultValue: "Back" })}
                  </button>
                  <button
                    type="button"
                    className="text-brand hover:underline"
                    onClick={resend}
                  >
                    {t("auth:resendCode", { defaultValue: "Resend code" })}
                  </button>
                </div>
              </form>
            )}
          </CardBody>
        </Card>

        <p className="mt-4 text-center text-xs text-text-muted">
          {t("admin:ipAllowlistSubtitle", {
            defaultValue: "Access is restricted and audited.",
          })}
        </p>
      </div>
    </div>
  );
}
