-- Push notifications: device-token registry, richer notification rows, and a
-- campaign log for admin broadcasts.
--
-- The notifications table (init.sql) already has id/user_id/title/body/read/
-- created_at; here we add a deep-link payload, a category, and who sent it so
-- admin broadcasts are distinguishable and auditable.

-- 1. Device push tokens (Expo push tokens registered by the mobile app).
create table if not exists public.push_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  token        text not null,
  platform     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists idx_push_tokens_user on public.push_tokens (user_id);

-- 2. Enrich notifications for admin sends + deep linking.
alter table public.notifications
  add column if not exists data     jsonb not null default '{}'::jsonb,
  add column if not exists category text,
  add column if not exists sent_by  uuid references public.users(id);

-- 3. Broadcast/campaign log — one row per admin send, for the dashboard history.
create table if not exists public.notification_campaigns (
  id              uuid primary key default gen_random_uuid(),
  sent_by         uuid references public.users(id),
  title           text not null,
  body            text not null,
  audience        jsonb not null,
  recipient_count int  not null default 0,
  pushed_count    int  not null default 0,
  failed_count    int  not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_campaigns_created on public.notification_campaigns (created_at desc);
