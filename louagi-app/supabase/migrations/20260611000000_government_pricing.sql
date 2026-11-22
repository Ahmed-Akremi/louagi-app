-- 2026-06-11: government-set pricing + new fee split.
--
-- Business rules:
--   * The Tunisian transport authority sets a flat fare per origin/destination
--     pair (routes.base_price). Drivers can NO LONGER pick a price — every
--     ride on the same route now charges the same per-seat amount.
--   * The 3 TND reservation surcharge stays per-booking (not per-seat), but
--     the split changes:
--         old: platform 1.5 + driver 1.5
--         new: platform 1.0 + driver 2.0
--   * Existing rides get back-filled to the government price so old listings
--     match new ones in the UI.

set search_path = public;

-- ─── New default fees on payments ───────────────────────────────────────────
alter table public.payments
  alter column platform_fee set default 1.000,
  alter column driver_fee   set default 2.000;

-- ─── Backfill existing rides to government price ────────────────────────────
update public.rides r
   set price_per_seat = rt.base_price
  from public.routes rt
 where rt.id = r.route_id
   and r.price_per_seat <> rt.base_price;

-- ─── RPC: create_reservation with new fee split ─────────────────────────────
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
  v_platform_fee   numeric(6,3) := 1.000;
  v_driver_fee     numeric(6,3) := 2.000;
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

  v_seat_cost   := v_ride.price_per_seat * p_seats;
  v_total_price := v_seat_cost + v_platform_fee + v_driver_fee;

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
