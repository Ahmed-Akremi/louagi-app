-- 2026-06-10: backing storage for client account flows that were mock-only.
--
-- Adds:
--   * users.preferences      — JSONB for things like { defaultSeats: 2 }.
--   * users.payment_account  — JSONB describing the payout/payment instrument
--                              ({ provider: 'flouci', account, updated_at }).
--                              Named *_account to avoid confusion with the
--                              public.payment_method ENUM type.
--   * support_tickets table  — backs CreateSupportTicket.

set search_path = public;

alter table public.users
  add column if not exists preferences jsonb not null default '{}'::jsonb,
  add column if not exists payment_account jsonb;

create table if not exists public.support_tickets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  topic      text not null,
  message    text not null,
  status     text not null default 'open' check (status in ('open', 'closed', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_user_created
  on public.support_tickets (user_id, created_at desc);

alter table public.support_tickets enable row level security;

drop policy if exists support_tickets_select_own on public.support_tickets;
create policy support_tickets_select_own on public.support_tickets
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists support_tickets_insert_own on public.support_tickets;
create policy support_tickets_insert_own on public.support_tickets
  for insert with check (user_id = auth.uid());

drop policy if exists support_tickets_admin_all on public.support_tickets;
create policy support_tickets_admin_all on public.support_tickets
  for all using (public.is_admin()) with check (public.is_admin());
