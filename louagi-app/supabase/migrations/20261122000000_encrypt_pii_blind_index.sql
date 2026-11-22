-- 2026-11-22: application-layer encryption of PII at rest.
--
-- The Node backend now AES-256-GCM-encrypts personal and user-authored columns
-- before writing them (server/src/lib/fieldCrypto.js) and decrypts centrally on
-- read (server/src/db.js). Ciphertext is randomised, so exact-match login
-- lookups and uniqueness move to keyed HMAC blind indexes. Existing rows are
-- encrypted + indexed by `node server/scripts/encrypt-pii.js`.

alter table public.users
  add column if not exists phone_hash text unique,
  add column if not exists email_hash text unique;

-- Ciphertext is not a valid inet.
alter table public.user_sessions
  alter column ip_address type text using ip_address::text;

-- ─── Data API hardening ─────────────────────────────────────────────────────
-- Supabase grants anon/authenticated EXECUTE explicitly, so the earlier
-- `revoke ... from public` left these SECURITY DEFINER RPCs (which trust a
-- caller-supplied user id) callable with the public key. Backend-only.
revoke execute on function public.create_reservation(uuid, uuid, int, text, text)          from anon, authenticated;
revoke execute on function public.cancel_reservation(uuid, uuid)                           from anon, authenticated;
revoke execute on function public.cancel_ride(uuid, uuid)                                  from anon, authenticated;
revoke execute on function public.delete_message(uuid, uuid, boolean)                      from anon, authenticated;
revoke execute on function public.book_delivery(uuid, uuid, smallint, text, numeric, text) from anon, authenticated;
revoke execute on function public.cleanup_expired_seat_locks()                             from anon, authenticated;

-- Views ran as their owner (bypassing RLS): active_users exposed every row,
-- password_hash included. Make them respect the caller's RLS.
alter view public.active_users           set (security_invoker = true);
alter view public.active_rides           set (security_invoker = true);
alter view public.active_reservations    set (security_invoker = true);
alter view public.active_payments        set (security_invoker = true);
alter view public.active_delivery        set (security_invoker = true);
alter view public.active_messages        set (security_invoker = true);
alter view public.driver_daily_earnings  set (security_invoker = true);
alter view public.driver_top_routes_week set (security_invoker = true);
alter view public.driver_current_rating  set (security_invoker = true);

-- Tables added after init without RLS: server-only (no policies).
alter table public.app_config             enable row level security;
alter table public.achievements           enable row level security;
alter table public.tiers                  enable row level security;
alter table public.push_tokens            enable row level security;
alter table public.notification_campaigns enable row level security;
