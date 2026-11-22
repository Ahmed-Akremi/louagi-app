-- 2026-06-17: move hard-coded frontend reference data into the database.
--
-- These columns/tables back data that previously lived as constants in the
-- React Native bundle:
--   * popular-route shortcuts on Home            (was LandingScreen `POPULAR`)
--   * the flat delivery price + fee split        (was DeliveryScreen `DELIVERY_PRICE`)
--   * the achievement catalogue + unlock rules   (was Membership `ACHIEVEMENTS`)
--
-- The schema lives here; the rows are loaded by supabase/seed.sql so the
-- catalogue stays editable without shipping an app release.
--
-- NOTE: the loyalty tier ladder is modelled the same way, in public.tiers — see
-- 20260618000000_loyalty_tier_discount.sql (schema) and supabase/seed.sql (rows).
-- public.create_reservation reads discount_pct straight from that table.

set search_path = public;

-- ─── Popular-route shortcut flag ────────────────────────────────────────────
alter table public.routes
  add column if not exists is_popular boolean not null default false;

-- ─── Generic key/value app configuration (delivery pricing, etc.) ───────────
create table if not exists public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ─── Achievement catalogue (icon + unlock threshold per badge) ──────────────
create table if not exists public.achievements (
  id             text primary key,
  i18n_key       text not null,
  icon           text not null,
  threshold_type text not null check (threshold_type in ('trips', 'distinct_routes')),
  threshold      int  not null check (threshold > 0),
  sort_order     int  not null
);
