-- ============================================================================
-- Louagi canonical schema — consolidated init.
--
-- This is the single source of truth for the public schema. It replaces 17
-- historical migrations. On any database it runs against, it:
--   1. Drops every table, function, view, enum, and policy this app owns.
--   2. Recreates them with the optimized layout the backend resolvers expect.
--
-- DATA LOSS WARNING: this migration is destructive by design. Do NOT run it
-- against a database holding production data unless that data has already
-- been migrated or backed up. The intended workflow is:
--   - Fresh environments: this is the only migration that runs.
--   - Existing dev/stage: a wipe is expected; reseed via supabase/seed.sql.
--
-- Layout (in order):
--   §0  Cleanup / drops
--   §1  Extensions
--   §2  Enums
--   §3  Helper functions (auth-context aware)
--   §4  Tables + constraints + triggers
--   §5  Indexes (optimized — no redundant or overlapping coverage)
--   §6  Views (soft-delete filtered + analytics)
--   §7  RPCs (atomic business operations, called by backend & RLS-safe)
--   §8  Row Level Security (enable + permissive policies)
--   §9  Realtime publications
--   §10 Grants
-- ============================================================================

set search_path = public, extensions;

-- §3 helper functions reference public.users, but the table is dropped in §0
-- and not recreated until §4. Without this, CREATE FUNCTION would resolve the
-- body too eagerly and fail. The functions are still type-checked at execution.
set check_function_bodies = off;

-- ─── §0 Cleanup ─────────────────────────────────────────────────────────────
-- Drop in reverse-dependency order. CASCADE handles policies, FKs, triggers,
-- and dependent indexes. Anything not present is silently ignored.

drop view if exists public.driver_daily_earnings    cascade;
drop view if exists public.driver_top_routes_week   cascade;
drop view if exists public.driver_current_rating    cascade;
drop view if exists public.active_users             cascade;
drop view if exists public.active_rides             cascade;
drop view if exists public.active_reservations      cascade;
drop view if exists public.active_payments          cascade;
drop view if exists public.active_delivery          cascade;
drop view if exists public.active_messages          cascade;

drop function if exists public.create_reservation(uuid, uuid, integer, text, text) cascade;
drop function if exists public.create_reservation(uuid, uuid, integer, payment_method, text) cascade;
drop function if exists public.cancel_reservation(uuid, uuid)                cascade;
drop function if exists public.cancel_ride(uuid, uuid)                       cascade;
drop function if exists public.delete_message(uuid, uuid, boolean)           cascade;
drop function if exists public.book_delivery(uuid, uuid, smallint, text, numeric, text) cascade;
drop function if exists public.cleanup_expired_seat_locks()                  cascade;
drop function if exists public.audit_log_immutable()                         cascade;
drop function if exists public.tg_set_updated_at()                           cascade;
drop function if exists public.handle_new_auth_user()                        cascade;
drop function if exists public.current_user_role()                           cascade;
drop function if exists public.is_admin()                                    cascade;

drop table if exists public.user_sessions    cascade;
drop table if exists public.refresh_tokens   cascade;
drop table if exists public.audit_log        cascade;
drop table if exists public.seat_locks       cascade;
drop table if exists public.messages         cascade;
drop table if exists public.delivery         cascade;
drop table if exists public.documents        cascade;
drop table if exists public.notifications    cascade;
drop table if exists public.reviews          cascade;
drop table if exists public.payments         cascade;
drop table if exists public.reservations     cascade;
drop table if exists public.rides            cascade;
drop table if exists public.routes           cascade;
drop table if exists public.admins           cascade;
drop table if exists public.driver_sessions  cascade;
drop table if exists public.drivers          cascade;
drop table if exists public.users            cascade;

drop type if exists public.document_kind       cascade;
drop type if exists public.payment_method      cascade;
drop type if exists public.payment_status      cascade;
drop type if exists public.reservation_status  cascade;
drop type if exists public.ride_status         cascade;
drop type if exists public.driver_status       cascade;
drop type if exists public.user_role           cascade;

-- ─── §1 Extensions ──────────────────────────────────────────────────────────
create extension if not exists pgcrypto    with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- ─── §2 Enums ───────────────────────────────────────────────────────────────
create type public.user_role          as enum ('passenger', 'driver', 'admin');
create type public.driver_status      as enum ('pending', 'verified', 'rejected');
create type public.ride_status        as enum ('scheduled', 'in_progress', 'completed', 'cancelled');
create type public.reservation_status as enum ('pending', 'confirmed', 'cancelled');
create type public.payment_status     as enum ('succeeded', 'failed', 'refunded', 'flagged');
create type public.payment_method     as enum ('card', 'cash', 'wallet', 'mobile_pay', 'flouci', 'konnect');
create type public.document_kind      as enum ('id_card', 'license', 'vehicle', 'other');

-- ─── §3 Helper functions ────────────────────────────────────────────────────
-- These run in auth context (Supabase anon/authenticated keys). The Node
-- backend uses service_role which bypasses RLS, so these only matter for
-- direct-from-client paths.

create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.users where id = auth.uid()), false)
$$;

-- ─── §4 Tables ──────────────────────────────────────────────────────────────

-- 4.1 users — profile + backend-issued credentials
create table public.users (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  phone_number    text unique,
  email           text,
  role            user_role not null default 'passenger',
  is_active       boolean not null default true,
  password_hash   text,
  notifications   jsonb not null default '{"sms": true, "push": true}'::jsonb,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Case-insensitive uniqueness on email; null emails are allowed and not unique.
create unique index users_email_lower_unique_idx
  on public.users (lower(email))
  where email is not null;

-- 4.2 drivers — verified driver records (1:1 with users)
create table public.drivers (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique references public.users(id) on delete cascade,
  plate_number             text not null unique,
  id_card_number           text not null,
  license_number           text not null,
  vehicle_brand            text not null,
  vehicle_model            text not null,
  seat_count               int  not null check (seat_count between 1 and 8),
  status                   driver_status not null default 'pending',
  verified_at              timestamptz,
  rejection_reason         text,
  license_expires_at       timestamptz,
  id_expires_at            timestamptz,
  payout_account           text,
  rating                   numeric(3,2) check (rating is null or rating between 0 and 5),
  trips_completed          int not null default 0,
  national_id_verified     boolean not null default false,
  criminal_record_check    boolean not null default false,
  two_fa_enabled           boolean not null default false,
  accepted_terms_version   text,
  accepted_terms_at        timestamptz,
  accepted_privacy_at      timestamptz,
  data_deletion_requested  boolean not null default false,
  vehicle_insurance_expiry timestamptz,
  created_at               timestamptz not null default now()
);

-- 4.3 driver_sessions — device-level session tracking for drivers
create table public.driver_sessions (
  id             uuid primary key default gen_random_uuid(),
  driver_id      uuid not null references public.users(id) on delete cascade,
  device_name    text,
  os_name        text,
  ip_address     text,
  is_revoked     boolean not null default false,
  last_active_at timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

-- 4.4 admins — admin role attachment + scoped permissions
create table public.admins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references public.users(id) on delete cascade,
  permissions jsonb not null default '["*"]'::jsonb,
  created_at  timestamptz not null default now()
);

-- 4.5 routes — fixed inter-city catalog
create table public.routes (
  id                     uuid primary key default gen_random_uuid(),
  origin_city            text not null,
  destination_city       text not null,
  distance_km            int  not null check (distance_km > 0),
  estimated_duration_min int  not null check (estimated_duration_min > 0),
  base_price             numeric(10,2) not null check (base_price >= 0),
  created_at             timestamptz not null default now(),
  unique (origin_city, destination_city)
);

-- 4.6 rides — driver-posted scheduled rides
create table public.rides (
  id                   uuid primary key default gen_random_uuid(),
  driver_id            uuid not null references public.drivers(id) on delete restrict,
  route_id             uuid not null references public.routes(id)  on delete restrict,
  departure_time       timestamptz not null,
  total_seats          int  not null check (total_seats between 1 and 8),
  available_seats      int  not null check (available_seats >= 0),
  price_per_seat       numeric(10,2) not null check (price_per_seat >= 0),
  status               ride_status not null default 'scheduled',
  accepts_delivery     boolean not null default true,
  max_delivery_slots   smallint not null default 3,
  delivery_slots_taken smallint not null default 0,
  deleted_at           timestamptz,
  created_at           timestamptz not null default now(),
  check (available_seats <= total_seats),
  check (delivery_slots_taken <= max_delivery_slots)
);

-- 4.7 reservations — passenger bookings on rides
create table public.reservations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete restrict,
  ride_id         uuid not null references public.rides(id) on delete restrict,
  seats_booked    int  not null check (seats_booked > 0),
  total_price     numeric(10,2) not null check (total_price >= 0),
  status          reservation_status not null default 'pending',
  idempotency_key text not null,
  booked_at       timestamptz not null default now(),
  cancelled_at    timestamptz,
  deleted_at      timestamptz,
  unique (user_id, idempotency_key),
  unique (ride_id, user_id)
);

-- 4.8 payments — 1:1 with reservation OR delivery (mutually exclusive)
create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  reservation_id   uuid references public.reservations(id) on delete restrict,
  delivery_id      uuid,                                                   -- FK added after delivery table
  method            payment_method not null,
  amount            numeric(10,2) not null check (amount >= 0),
  status            payment_status not null,
  gateway_reference text,
  flagged           boolean not null default false,
  flagged_reason    text,
  platform_fee      numeric(6,3) not null default 1.500,
  driver_fee        numeric(6,3) not null default 1.500,
  reservation_fee   numeric(6,3) generated always as (platform_fee + driver_fee) stored,
  refunded_amount   numeric(10,2),
  refund_type       text,
  paid_at           timestamptz not null default now(),
  refunded_at       timestamptz,
  deleted_at        timestamptz,
  constraint payment_single_source check (
    (reservation_id is not null) <> (delivery_id is not null)
  )
);

create unique index payments_reservation_id_unique_idx
  on public.payments (reservation_id)
  where reservation_id is not null;

-- 4.9 reviews — 1:1 with reservation
create table public.reviews (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.reservations(id) on delete cascade,
  rating         int  not null check (rating between 1 and 5),
  comment        text,
  created_at     timestamptz not null default now()
);

-- 4.10 notifications — in-app notification feed
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  title      text not null,
  body       text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

-- 4.11 documents — KYC / vehicle docs in Supabase Storage
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  kind         document_kind not null,
  name         text not null,
  mime         text not null,
  size_bytes   bigint not null check (size_bytes > 0),
  storage_path text,
  uploaded_at  timestamptz not null default now()
);

-- 4.12 delivery — box-delivery add-on on rides
create table public.delivery (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete restrict,
  ride_id          uuid not null references public.rides(id) on delete restrict,
  severity_tier    smallint not null check (severity_tier in (1, 2, 3)),
  severity_label   text not null,
  item_description text,
  price            numeric(6,3) not null check (price >= 0),
  status           text not null default 'pending'
                   check (status in ('pending','confirmed','picked_up','delivered','cancelled')),
  booked_at        timestamptz not null default now(),
  cancelled_at     timestamptz,
  driver_notes     text,
  deleted_at       timestamptz
);

-- Now wire payments.delivery_id FK (delivery table exists).
alter table public.payments
  add constraint payments_delivery_id_fkey
  foreign key (delivery_id) references public.delivery(id) on delete restrict;

-- 4.13 messages — direct-message threads
create table public.messages (
  id                  uuid primary key default gen_random_uuid(),
  sender_id           uuid not null references public.users(id) on delete cascade,
  receiver_id         uuid not null references public.users(id) on delete cascade,
  content             text not null,
  is_read             boolean not null default false,
  deleted_by_sender   boolean not null default false,
  deleted_by_receiver boolean not null default false,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now()
);

-- 4.14 seat_locks — 10-min TTL atomic booking locks
create table public.seat_locks (
  id              uuid primary key default gen_random_uuid(),
  ride_id         uuid not null references public.rides(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  seats           int  not null check (seats > 0),
  idempotency_key text not null,
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now(),
  unique (ride_id, user_id)
);

-- 4.15 audit_log — append-only audit trail (immutable via trigger)
create table public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid,
  actor_role    user_role,
  action        text not null,
  target_entity text,
  target_id     uuid,
  metadata      jsonb,
  ip_address    text,
  created_at    timestamptz not null default now()
);

-- 4.16 refresh_tokens — JWT refresh-token store with rotation
create table public.refresh_tokens (
  jti             text primary key,
  user_id         uuid not null references public.users(id) on delete cascade,
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  replaced_by_jti text,
  created_at      timestamptz not null default now()
);

-- 4.17 user_sessions — JWT session tracking; access tokens carry jti = session_id
create table public.user_sessions (
  session_id     uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  device_info    text,
  ip_address     inet,
  expires_at     timestamptz not null,
  revoked_at     timestamptz,
  last_active_at timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

-- 4.x Triggers ──────────────────────────────────────────────────────────────

-- updated_at maintenance on public.users
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.tg_set_updated_at();

-- audit_log immutability
create or replace function public.audit_log_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_log rows are immutable';
end;
$$;

create trigger audit_log_no_update before update on public.audit_log
  for each row execute function public.audit_log_immutable();
create trigger audit_log_no_delete before delete on public.audit_log
  for each row execute function public.audit_log_immutable();

-- ─── §5 Indexes ─────────────────────────────────────────────────────────────
-- Optimized for the queries the Node backend actually issues. No redundant
-- coverage: where a multi-column index serves a single-column lookup via
-- prefix match, the single-column index is omitted.

-- USERS
create index idx_users_role         on public.users (role);
create index idx_users_created_desc on public.users (created_at desc);
create index idx_users_active       on public.users (id) where deleted_at is null;

-- DRIVERS  (PK + UNIQUE(user_id, plate_number) already cover lookup paths)
create index idx_drivers_status on public.drivers (status);

-- DRIVER_SESSIONS
create index idx_driver_sessions_driver on public.driver_sessions (driver_id, created_at desc);

-- ROUTES  — case-insensitive lookup for CreateRide route matching
create index idx_routes_origin_dest_lower
  on public.routes (lower(origin_city), lower(destination_city));

-- RIDES
create index idx_rides_driver_departure    on public.rides (driver_id, departure_time);
create index idx_rides_route_departure     on public.rides (route_id, departure_time);
create index idx_rides_scheduled_departure on public.rides (departure_time)
  where status = 'scheduled';
create index idx_rides_active_status       on public.rides (id)
  where status in ('scheduled', 'in_progress');
create index idx_rides_active              on public.rides (id) where deleted_at is null;

-- RESERVATIONS  (UNIQUE(user_id, idempotency_key) + UNIQUE(ride_id, user_id)
-- already cover those lookup paths via prefix match)
create index idx_reservations_user_status on public.reservations (user_id, status);
create index idx_reservations_booked_desc on public.reservations (booked_at desc);
create index idx_reservations_active      on public.reservations (id) where deleted_at is null;

-- PAYMENTS  (payments_reservation_id_unique_idx covers reservation_id lookups)
create index idx_payments_reservation_status on public.payments (reservation_id, status);
create index idx_payments_delivery           on public.payments (delivery_id)
  where delivery_id is not null;
create index idx_payments_paid_desc          on public.payments (paid_at desc);
create index idx_payments_paid_succeeded     on public.payments (paid_at)
  where status = 'succeeded';
create index idx_payments_flagged            on public.payments (id)
  where flagged = true;
create index idx_payments_active             on public.payments (id) where deleted_at is null;

-- REVIEWS  (UNIQUE(reservation_id) covers the FK lookup used by RLS)
-- No additional indexes needed.

-- NOTIFICATIONS
create index idx_notifications_user_unread on public.notifications (user_id)
  where read = false;

-- DOCUMENTS
create index idx_documents_user on public.documents (user_id);

-- DELIVERY
create index idx_delivery_user_status on public.delivery (user_id, status);
create index idx_delivery_ride_status on public.delivery (ride_id, status);
create index idx_delivery_active      on public.delivery (id) where deleted_at is null;

-- MESSAGES
create index idx_messages_thread         on public.messages (sender_id, receiver_id, created_at);
create index idx_messages_thread_reverse on public.messages (receiver_id, sender_id, created_at);
create index idx_messages_sender_active  on public.messages (sender_id, created_at desc)
  where deleted_by_sender = false and deleted_by_receiver = false;
create index idx_messages_receiver_active on public.messages (receiver_id, created_at desc)
  where deleted_by_sender = false and deleted_by_receiver = false;
create index idx_messages_unread         on public.messages (receiver_id)
  where is_read = false;
create index idx_messages_active         on public.messages (id) where deleted_at is null;

-- SEAT_LOCKS  (UNIQUE(ride_id, user_id) covers lookup)
create index idx_seat_locks_expires on public.seat_locks (expires_at);

-- AUDIT_LOG
create index idx_audit_action_created on public.audit_log (action, created_at desc);
create index idx_audit_actor          on public.audit_log (actor_id);
create index idx_audit_created_desc   on public.audit_log (created_at desc);

-- REFRESH_TOKENS
create index idx_refresh_tokens_user    on public.refresh_tokens (user_id);
create index idx_refresh_tokens_expires on public.refresh_tokens (expires_at)
  where revoked_at is null;

-- USER_SESSIONS
create index idx_user_sessions_user    on public.user_sessions (user_id);
create index idx_user_sessions_expires on public.user_sessions (expires_at)
  where revoked_at is null;

-- ─── §6 Views ───────────────────────────────────────────────────────────────

-- Soft-delete-filtered views. Use these when the caller wants only live rows.
create view public.active_users        as select * from public.users        where deleted_at is null;
create view public.active_rides        as select * from public.rides        where deleted_at is null;
create view public.active_reservations as select * from public.reservations where deleted_at is null;
create view public.active_payments     as select * from public.payments     where deleted_at is null;
create view public.active_delivery     as select * from public.delivery     where deleted_at is null;
create view public.active_messages     as select * from public.messages     where deleted_at is null;

-- Analytics views consumed by DriverEarnings / AdminStats.
create view public.driver_daily_earnings as
  select
    r.driver_id,
    date_trunc('day', r.departure_time) as earnings_date,
    sum(res.total_price)                as total_amount,
    count(r.id)                          as trips_count
  from public.rides r
  join public.reservations res on res.ride_id = r.id
  where r.status = 'completed' and res.status = 'confirmed'
  group by r.driver_id, date_trunc('day', r.departure_time);

create view public.driver_top_routes_week as
  select
    r.driver_id,
    rt.origin_city,
    rt.destination_city,
    count(r.id) as trip_count
  from public.rides r
  join public.routes rt on rt.id = r.route_id
  where r.status = 'completed'
    and r.departure_time >= date_trunc('week', now())
  group by r.driver_id, rt.origin_city, rt.destination_city
  order by trip_count desc;

create view public.driver_current_rating as
  select
    r.driver_id,
    avg(rev.rating)::numeric(3,2) as average_rating,
    count(rev.id)                  as total_reviews
  from public.reviews rev
  join public.reservations res on res.id = rev.reservation_id
  join public.rides r          on r.id   = res.ride_id
  group by r.driver_id;

-- ─── §7 RPCs ────────────────────────────────────────────────────────────────

-- 7.1 create_reservation — atomic seat-lock + reservation + payment
create or replace function public.create_reservation(
  p_user_id         uuid,
  p_ride_id         uuid,
  p_seats           int,
  p_payment_method  text default 'card',
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride           record;
  v_seat_cost      numeric(10,2);
  v_total_price    numeric(10,2);
  v_reservation_id uuid;
  v_key            text;
  v_platform_fee   numeric(6,3) := 1.500;
  v_driver_fee     numeric(6,3) := 1.500;
  v_existing_id    uuid;
begin
  v_key := coalesce(p_idempotency_key, gen_random_uuid()::text);

  if p_seats < 1 or p_seats > 4 then
    raise exception 'Invalid seat count (must be 1-4)';
  end if;

  -- Idempotency: same (user, key) returns the prior reservation id.
  select id into v_existing_id
  from public.reservations
  where user_id = p_user_id and idempotency_key = v_key
  limit 1;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  select * into v_ride from public.rides where id = p_ride_id for update;

  if v_ride is null                   then raise exception 'Ride not found'; end if;
  if v_ride.status <> 'scheduled'     then raise exception 'Ride no longer accepting bookings'; end if;
  if v_ride.available_seats < p_seats then
    raise exception 'Not enough seats (available: %, requested: %)', v_ride.available_seats, p_seats;
  end if;

  v_seat_cost   := v_ride.price_per_seat * p_seats;
  v_total_price := v_seat_cost + v_platform_fee + v_driver_fee;

  -- Per-passenger dedup via UNIQUE(ride_id, user_id).
  begin
    insert into public.reservations (
      user_id, ride_id, seats_booked, total_price, status, idempotency_key
    ) values (
      p_user_id, p_ride_id, p_seats, v_total_price, 'confirmed', v_key
    )
    returning id into v_reservation_id;
  exception when unique_violation then
    if sqlerrm like '%reservations_ride_id_user_id_key%' then
      raise exception 'DUPLICATE_BOOKING';
    else
      raise;
    end if;
  end;

  update public.rides
  set available_seats = available_seats - p_seats
  where id = p_ride_id;

  insert into public.payments (
    reservation_id, method, amount, platform_fee, driver_fee, status, gateway_reference
  ) values (
    v_reservation_id,
    p_payment_method::payment_method,
    v_total_price,
    v_platform_fee,
    v_driver_fee,
    'succeeded',
    'RPC-' || upper(substr(gen_random_uuid()::text, 1, 12))
  );

  return v_reservation_id;
end;
$$;

-- 7.2 cancel_reservation — owner-initiated cancel + seat restore + refund
create or replace function public.cancel_reservation(
  p_user_id        uuid,
  p_reservation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res record;
begin
  select res.*, r.departure_time
  into v_res
  from public.reservations res
  join public.rides r on r.id = res.ride_id
  where res.id = p_reservation_id
  for update;

  if v_res is null              then raise exception 'Reservation not found'; end if;
  if v_res.user_id <> p_user_id then raise exception 'Forbidden'; end if;
  if v_res.status <> 'confirmed' then raise exception 'Already cancelled'; end if;
  if (extract(epoch from v_res.departure_time) - extract(epoch from now())) / 60 < 120 then
    raise exception 'Too close to departure to cancel';
  end if;

  update public.reservations
  set status = 'cancelled', cancelled_at = now()
  where id = p_reservation_id;

  update public.rides
  set available_seats = available_seats + v_res.seats_booked
  where id = v_res.ride_id;

  -- Refund seat cost only; reservation fee (platform + driver) is non-refundable.
  update public.payments
  set status          = 'refunded',
      refunded_at     = now(),
      refunded_amount = amount - platform_fee - driver_fee,
      refund_type     = 'partial'
  where reservation_id = p_reservation_id and status = 'succeeded';
end;
$$;

-- 7.3 cancel_ride — driver/admin cancels a ride + all confirmed reservations
create or replace function public.cancel_ride(
  p_driver_user_id uuid,
  p_ride_id        uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride  record;
  v_count int;
begin
  select r.*, d.user_id as owner_id
  into v_ride
  from public.rides r
  join public.drivers d on d.id = r.driver_id
  where r.id = p_ride_id
  for update;

  if v_ride is null                                       then raise exception 'Ride not found'; end if;
  if v_ride.owner_id <> p_driver_user_id                  then raise exception 'Forbidden'; end if;
  if v_ride.status in ('completed', 'in_progress')        then
    raise exception 'Cannot cancel a ride already in progress or completed';
  end if;

  update public.rides set status = 'cancelled' where id = p_ride_id;

  with cancelled as (
    update public.reservations
    set status = 'cancelled', cancelled_at = now()
    where ride_id = p_ride_id and status = 'confirmed'
    returning id
  )
  select count(*)::int into v_count from cancelled;

  update public.payments
  set status = 'refunded', refunded_at = now()
  where reservation_id in (
    select id from public.reservations
    where ride_id = p_ride_id and status = 'cancelled'
  )
    and status = 'succeeded';

  return v_count;
end;
$$;

-- 7.4 delete_message — sender soft-deletes (one side or both); receiver soft-deletes own side
create or replace function public.delete_message(
  p_user_id      uuid,
  p_message_id   uuid,
  p_for_everyone boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_msg record;
begin
  select * into v_msg from public.messages where id = p_message_id for update;

  if v_msg is null then raise exception 'Message not found'; end if;

  if v_msg.sender_id = p_user_id then
    if p_for_everyone then
      update public.messages
      set deleted_by_sender = true, deleted_by_receiver = true
      where id = p_message_id;
    else
      update public.messages
      set deleted_by_sender = true
      where id = p_message_id;
    end if;
  elsif v_msg.receiver_id = p_user_id then
    update public.messages
    set deleted_by_receiver = true
    where id = p_message_id;
  else
    raise exception 'Forbidden';
  end if;
end;
$$;

-- 7.5 book_delivery — atomic delivery insert + ride slot increment
create or replace function public.book_delivery(
  p_ride_id        uuid,
  p_user_id        uuid,
  p_severity_tier  smallint,
  p_severity_label text,
  p_price          numeric(6,3),
  p_description    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery_id uuid;
  v_slots_taken smallint;
  v_max_slots   smallint;
begin
  select delivery_slots_taken, max_delivery_slots
  into v_slots_taken, v_max_slots
  from public.rides where id = p_ride_id for update;

  if v_slots_taken is null     then raise exception 'Ride not found'; end if;
  if v_slots_taken >= v_max_slots then raise exception 'No delivery slots available'; end if;

  insert into public.delivery (
    user_id, ride_id, severity_tier, severity_label,
    item_description, price, status
  ) values (
    p_user_id, p_ride_id, p_severity_tier, p_severity_label,
    p_description, p_price, 'pending'
  )
  returning id into v_delivery_id;

  update public.rides
  set delivery_slots_taken = delivery_slots_taken + 1
  where id = p_ride_id;

  return v_delivery_id;
end;
$$;

-- 7.6 cleanup_expired_seat_locks — called every 5 min by the Node backend
create or replace function public.cleanup_expired_seat_locks()
returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.seat_locks where expires_at < now() returning 1
  )
  select coalesce(count(*), 0)::int from deleted;
$$;

-- ─── §8 Row Level Security ──────────────────────────────────────────────────
-- The Node backend uses the service_role key which bypasses RLS, so these
-- policies primarily protect the anon/authenticated keys that ship in the
-- mobile bundle. Tables with no permissive policy are effectively server-only.

-- USERS
alter table public.users enable row level security;
create policy users_select_self_or_admin on public.users
  for select using (id = auth.uid() or public.is_admin());
create policy users_update_self on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy users_admin_all on public.users
  for all using (public.is_admin()) with check (public.is_admin());

-- DRIVERS
alter table public.drivers enable row level security;
create policy drivers_public_verified on public.drivers
  for select using (status = 'verified');
create policy drivers_select_self on public.drivers
  for select using (user_id = auth.uid());
create policy drivers_insert_self on public.drivers
  for insert with check (user_id = auth.uid());
create policy drivers_update_self on public.drivers
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy drivers_admin_all on public.drivers
  for all using (public.is_admin()) with check (public.is_admin());

-- DRIVER_SESSIONS
alter table public.driver_sessions enable row level security;
create policy driver_sessions_select_own on public.driver_sessions
  for select using (driver_id = auth.uid());
create policy driver_sessions_insert_own on public.driver_sessions
  for insert with check (driver_id = auth.uid());
create policy driver_sessions_update_own on public.driver_sessions
  for update using (driver_id = auth.uid()) with check (driver_id = auth.uid());

-- ADMINS
alter table public.admins enable row level security;
create policy admins_admin_all on public.admins
  for all using (public.is_admin()) with check (public.is_admin());

-- ROUTES — readable to any authenticated user, writable only by admins
alter table public.routes enable row level security;
create policy routes_select_all_authed on public.routes
  for select using (auth.role() = 'authenticated');
create policy routes_admin_write on public.routes
  for all using (public.is_admin()) with check (public.is_admin());

-- RIDES
alter table public.rides enable row level security;
create policy rides_select_scheduled on public.rides
  for select using (
    status = 'scheduled'
    or driver_id in (select id from public.drivers where user_id = auth.uid())
    or public.is_admin()
  );
create policy rides_driver_insert on public.rides
  for insert with check (
    driver_id in (
      select id from public.drivers
      where user_id = auth.uid() and status = 'verified'
    )
  );
create policy rides_driver_update on public.rides
  for update using (
    driver_id in (select id from public.drivers where user_id = auth.uid())
  );
create policy rides_admin_all on public.rides
  for all using (public.is_admin()) with check (public.is_admin());

-- RESERVATIONS — server-side only for writes; passengers/drivers can read own
alter table public.reservations enable row level security;
create policy reservations_select_own on public.reservations
  for select using (
    user_id = auth.uid()
    or ride_id in (
      select r.id from public.rides r
      join public.drivers d on d.id = r.driver_id
      where d.user_id = auth.uid()
    )
    or public.is_admin()
  );
create policy reservations_admin_all on public.reservations
  for all using (public.is_admin()) with check (public.is_admin());

-- PAYMENTS — owners see their own reservation+delivery payments
alter table public.payments enable row level security;
create policy payments_select_own on public.payments
  for select using (
    reservation_id in (select id from public.reservations where user_id = auth.uid())
    or delivery_id in (select id from public.delivery where user_id = auth.uid())
    or public.is_admin()
  );
create policy payments_admin_all on public.payments
  for all using (public.is_admin()) with check (public.is_admin());

-- REVIEWS
alter table public.reviews enable row level security;
create policy reviews_select_all on public.reviews
  for select using (true);
create policy reviews_insert_own on public.reviews
  for insert with check (
    exists (
      select 1 from public.reservations res
      join public.rides r on res.ride_id = r.id
      where res.id = reservation_id
        and res.user_id = auth.uid()
        and r.status = 'completed'
    )
  );
create policy reviews_admin_all on public.reviews
  for all using (public.is_admin()) with check (public.is_admin());

-- NOTIFICATIONS
alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());
create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_admin_all on public.notifications
  for all using (public.is_admin()) with check (public.is_admin());

-- DOCUMENTS
alter table public.documents enable row level security;
create policy documents_select_own on public.documents
  for select using (user_id = auth.uid() or public.is_admin());
create policy documents_insert_own on public.documents
  for insert with check (user_id = auth.uid());
create policy documents_admin_all on public.documents
  for all using (public.is_admin()) with check (public.is_admin());

-- DELIVERY
alter table public.delivery enable row level security;
create policy delivery_select_own on public.delivery
  for select using (user_id = auth.uid());
create policy delivery_insert_own on public.delivery
  for insert with check (user_id = auth.uid());
create policy delivery_driver_select on public.delivery
  for select using (
    ride_id in (
      select id from public.rides where driver_id in (
        select id from public.drivers where user_id = auth.uid()
      )
    )
  );
create policy delivery_driver_update on public.delivery
  for update using (
    ride_id in (
      select id from public.rides where driver_id in (
        select id from public.drivers where user_id = auth.uid()
      )
    )
  );
create policy delivery_admin_all on public.delivery
  for all using (public.is_admin()) with check (public.is_admin());

-- MESSAGES — respect soft-delete flags in SELECT
alter table public.messages enable row level security;
create policy messages_select_own on public.messages
  for select using (
    (sender_id   = auth.uid() and not deleted_by_sender)
    or (receiver_id = auth.uid() and not deleted_by_receiver)
  );
create policy messages_insert_own on public.messages
  for insert with check (sender_id = auth.uid());
create policy messages_update_own on public.messages
  for update using (receiver_id = auth.uid()) with check (receiver_id = auth.uid());
create policy messages_admin_all on public.messages
  for all using (public.is_admin()) with check (public.is_admin());

-- SEAT_LOCKS, AUDIT_LOG, REFRESH_TOKENS, USER_SESSIONS — server-only.
-- RLS enabled with NO permissive policies → only service_role can touch them.
alter table public.seat_locks      enable row level security;
alter table public.audit_log       enable row level security;
alter table public.refresh_tokens  enable row level security;
alter table public.user_sessions   enable row level security;

-- ─── §9 Realtime publications ───────────────────────────────────────────────
do $$
begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if found then
    execute 'alter publication supabase_realtime add table public.delivery';
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
exception when duplicate_object then
  null;
end $$;

-- ─── §10 Grants ─────────────────────────────────────────────────────────────
-- RPCs are SECURITY DEFINER and explicitly granted to the service_role used
-- by the Node backend. Revoke from PUBLIC so the anon/authenticated keys can
-- never invoke them directly.

revoke all on function public.create_reservation(uuid, uuid, int, text, text)             from public;
revoke all on function public.cancel_reservation(uuid, uuid)                              from public;
revoke all on function public.cancel_ride(uuid, uuid)                                     from public;
revoke all on function public.delete_message(uuid, uuid, boolean)                         from public;
revoke all on function public.book_delivery(uuid, uuid, smallint, text, numeric, text)    from public;
revoke all on function public.cleanup_expired_seat_locks()                                from public;

grant execute on function public.create_reservation(uuid, uuid, int, text, text)          to service_role;
grant execute on function public.cancel_reservation(uuid, uuid)                           to service_role;
grant execute on function public.cancel_ride(uuid, uuid)                                  to service_role;
grant execute on function public.delete_message(uuid, uuid, boolean)                      to service_role;
grant execute on function public.book_delivery(uuid, uuid, smallint, text, numeric, text) to service_role;
grant execute on function public.cleanup_expired_seat_locks()                             to service_role;
