-- 2026-06-18: loyalty tier catalogue + tier discount on ride reservations.
--
-- Passengers accrue loyalty points (100 / confirmed trip + 1 / TND spent). At
-- tier thresholds they unlock a percentage discount on the seat fare. The
-- tier → discount ladder used to live in JS (server/src/lib/tiers.js); it now
-- lives in public.tiers, the single source of truth read directly by
-- public.create_reservation. This keeps it editable without an app release,
-- matching public.achievements.
--
-- Schema lives here; the rows are loaded by supabase/seed.sql (same as the
-- achievement catalogue). create_reservation treats an EMPTY tiers table as
-- "no loyalty discount" (coalesce → 0), so the booking path is always safe —
-- but the table must be seeded for the programme to be active.

set search_path = public;

-- ─── Loyalty tier catalogue ─────────────────────────────────────────────────
create table if not exists public.tiers (
  id           text primary key,                 -- short code: 'bronze', 'gold', …
  i18n_key     text not null,                    -- label key, e.g. 'tierGold'
  min_points   int  not null check (min_points >= 0),
  discount_pct numeric(5,2) not null check (discount_pct >= 0 and discount_pct <= 100),
  perks        text[] not null default '{}',     -- i18n keys for descriptive perks
  sort_order   int  not null
);

-- Record the applied percentage on the reservation so booking detail + admin
-- views are self-describing (0 for every historical row).
alter table public.reservations
  add column if not exists discount_pct numeric(5,2) not null default 0
    check (discount_pct >= 0 and discount_pct <= 100);

-- Replace create_reservation: resolve the passenger's tier discount inside the
-- authoritative pricing path. Drop both prior signatures (the original 5-arg and
-- the short-lived 6-arg that took the percentage from Node) so neither lingers.
drop function if exists public.create_reservation(uuid, uuid, int, text, text) cascade;
drop function if exists public.create_reservation(uuid, uuid, int, text, text, numeric) cascade;

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
  v_discount       numeric(10,2);
  v_total_price    numeric(10,2);
  v_reservation_id uuid;
  v_key            text;
  v_platform_fee   numeric(6,3) := 1.000;
  v_driver_fee     numeric(6,3) := 2.000;
  v_points         int;
  v_pct            numeric(5,2);
  v_existing_id    uuid;
begin
  v_key := coalesce(p_idempotency_key, gen_random_uuid()::text);

  if p_seats < 1 or p_seats > 4 then
    raise exception 'Invalid seat count (must be 1-4)';
  end if;

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

  -- Loyalty points from the passenger's own history (excludes this booking).
  -- Matches GetProfile / loyaltyPoints: 100 per confirmed trip + 1 per TND spent.
  select
    coalesce(count(*) filter (where status = 'confirmed'), 0)::int * 100
    + round(coalesce(sum(total_price) filter (where status <> 'cancelled'), 0))::int
  into v_points
  from public.reservations
  where user_id = p_user_id;

  -- Highest tier the points reach; no catalogue / no match → 0% (graceful).
  select discount_pct into v_pct
  from public.tiers
  where min_points <= v_points
  order by min_points desc
  limit 1;
  v_pct := coalesce(v_pct, 0);

  -- Discount applies to the seat fare only; the flat 3 TND surcharge is untouched.
  v_seat_cost   := v_ride.price_per_seat * p_seats;
  v_discount    := round(v_seat_cost * v_pct / 100.0, 2);
  v_total_price := v_seat_cost - v_discount + v_platform_fee + v_driver_fee;

  begin
    insert into public.reservations (
      user_id, ride_id, seats_booked, total_price, status, idempotency_key, discount_pct
    ) values (
      p_user_id, p_ride_id, p_seats, v_total_price, 'confirmed', v_key, v_pct
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

-- SECURITY DEFINER posture: only the Node backend's service_role may invoke it.
revoke all on function public.create_reservation(uuid, uuid, int, text, text) from public;
grant execute on function public.create_reservation(uuid, uuid, int, text, text) to service_role;
