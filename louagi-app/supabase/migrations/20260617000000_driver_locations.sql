-- 2026-06-17 · Live driver location for real-time package tracking.
--
-- One latest-known GPS fix per driver, upserted in place. We keep NO history,
-- so ~5s pings cause no write amplification and no audit-log noise. Passenger
-- visibility is enforced entirely in the GetDeliveryTracking query handler: a
-- fix is only ever returned to the passenger who owns a delivery on that
-- driver's ride, and only while that ride is in_progress.

create table public.driver_locations (
  driver_id  uuid primary key references public.drivers(id) on delete cascade,
  latitude   double precision not null check (latitude between -90 and 90),
  longitude  double precision not null check (longitude between -180 and 180),
  heading    double precision check (heading is null or (heading >= 0 and heading < 360)),
  speed      double precision check (speed is null or speed >= 0),
  accuracy   double precision check (accuracy is null or accuracy >= 0),
  updated_at timestamptz not null default now()
);

-- Refresh updated_at on every upsert (the on-conflict path is an UPDATE).
create trigger driver_locations_set_updated_at
  before update on public.driver_locations
  for each row execute function public.tg_set_updated_at();

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- The Node backend uses the service_role key (bypasses RLS); every passenger
-- read goes through the server's GetDeliveryTracking, never directly against
-- this table. These policies only bound the anon/authenticated key shipped in
-- the mobile bundle: a driver may write only their own row, admins have full
-- access, and there is deliberately no public SELECT policy.
alter table public.driver_locations enable row level security;

create policy driver_locations_self_write on public.driver_locations
  for all
  using (driver_id in (select id from public.drivers where user_id = auth.uid()))
  with check (driver_id in (select id from public.drivers where user_id = auth.uid()));

create policy driver_locations_admin_all on public.driver_locations
  for all using (public.is_admin()) with check (public.is_admin());
