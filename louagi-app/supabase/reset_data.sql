-- ════════════════════════════════════════════════════════════════════════════
-- Wipe ALL seeded/app data so the dataset can be re-seeded cleanly.
--
--   Run BEFORE re-running seed.sql when you don't want to drop the whole DB:
--     psql "$DATABASE_URL" -f supabase/reset_data.sql
--     psql "$DATABASE_URL" -f supabase/seed.sql
--   (or just `supabase db reset`, which drops + replays migrations + seed.)
--   Then: node server/scripts/encrypt-pii.js  (encrypts PII + fills login hashes)
--
-- TRUNCATE … RESTART IDENTITY CASCADE empties every table in one shot; CASCADE
-- follows the foreign keys so order doesn't matter. TRUNCATE does NOT fire the
-- row-level BEFORE DELETE trigger on audit_log, so the append-only guard does
-- not block this. Schema, functions, RLS policies and migrations are untouched.
-- ════════════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

truncate table
  public.audit_log,
  public.refresh_tokens,
  public.user_sessions,
  public.driver_sessions,
  public.seat_locks,
  public.messages,
  public.notifications,
  public.notification_campaigns,
  public.push_tokens,
  public.support_tickets,
  public.reviews,
  public.payments,
  public.delivery,
  public.reservations,
  public.driver_locations,
  public.rides,
  public.documents,
  public.admins,
  public.drivers,
  public.users,
  public.routes,
  public.app_config,
  public.achievements,
  public.tiers
restart identity cascade;
