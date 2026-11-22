-- Per-admin TOTP step-up for sensitive actions (impersonation).
--
-- admin_totp_secret holds the base32 secret, encrypted at the application
-- layer when PII_ENCRYPTION_KEY is configured (see server/src/lib/fieldCrypto.js).
-- Enrollment is two-step: AdminSetupTotp stores the secret with enabled=false;
-- AdminActivateTotp flips enabled after the admin proves a working code, so a
-- mis-scanned secret can never lock anyone out.

alter table public.users
  add column if not exists admin_totp_secret text,
  add column if not exists admin_totp_enabled boolean not null default false;
