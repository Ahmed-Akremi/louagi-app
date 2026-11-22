-- Local-development seed. Run automatically by `supabase start` and
-- `supabase db reset`. It is NOT applied to production.
--
-- This is a LARGE, internally-consistent demo dataset that exercises every
-- section of the app: passengers/drivers/admins, the route catalogue, scheduled
-- rides for the NEXT 30 DAYS, live in-progress rides with GPS, historical
-- completed/cancelled rides, reservations (with loyalty discounts), payments
-- (incl. refunds + flagged), deliveries across their lifecycle, reviews, chat
-- threads, notifications, support tickets, KYC documents, sessions, seat locks,
-- and the admin audit trail. Volumes are generated deterministically so re-runs
-- are idempotent and UUIDs stay stable.
--
-- The passenger roster is shaped to span the whole loyalty ladder:
--   Diamond  Ines    · Platinum Mariem · Gold Yassine/Sirine
--   Silver   Anis/Rania · Bronze Hatem/Walid/Nour
-- so tier perks AND the seat-fare discount are all visible in the demo.
--
-- Demo credentials (documented; not in the RN bundle):
--   passenger: +21698765432 / Passenger1     (Mariem — Platinum tier)
--   driver:    +21622334455 / Driver1234      (Khaled — verified)
--   admin:     +21655000000 / AdminLou2026     (Admin Ops)
-- Every other seeded passenger shares password `Passenger1`, every other driver
-- `Driver1234`, the second admin `AdminLou2026`. OTP is hardcoded in dev:
--   DEV_OTP_CODE=123456
-- Replace with an SMTP/SMS provider before production.
--
-- AFTER SEEDING run `node server/scripts/encrypt-pii.js`: rows are inserted in
-- plaintext without users.phone_hash/email_hash, so nobody can log in until it
-- encrypts the PII and fills the blind indexes.

set search_path = public, extensions;

-- Deterministic UUID helper (session-temp). pg_temp.sid('ride-future-12')
-- returns a stable v5 UUID, so generated rows have fixed ids across re-runs.
-- v5 ids carry version nibble 5, the fixed literal ids below are v4, so the two
-- families can never collide.
create or replace function pg_temp.sid(name text) returns uuid
  language sql immutable as
$$ select extensions.uuid_generate_v5('00000000-0000-4000-8000-000000000000'::uuid, name) $$;

-- ════════════════════════════════════════════════════════════════════════════
-- §1 Users — 24 passengers, 14 drivers, 2 admins
-- ════════════════════════════════════════════════════════════════════════════
insert into public.users (
  id, full_name, phone_number, email, role, password_hash, is_active,
  notifications, preferences, payment_account, created_at
) values
  -- Passengers ----------------------------------------------------------------
  ('f06de460-2e24-4067-84aa-000000000101', 'Mariem Ben Salem', '+21698765432', 'mariem@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true,
   '{"sms": true, "push": true, "marketing": false}'::jsonb, '{"defaultSeats": 2}'::jsonb, jsonb_build_object('provider', 'flouci', 'account', 'FL-2271-0098', 'updated_at', to_char((now() - interval '7 months') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')), now() - interval '14 months'),
  ('7770f77c-23bc-480c-886d-000000000111', 'Yassine Gharbi',  '+21698000111', 'yassine@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true,
   '{"sms": true, "push": true, "marketing": true}'::jsonb, '{"defaultSeats": 1}'::jsonb, null, now() - interval '9 months'),
  ('7870f910-9c85-40ce-8802-000000000112', 'Sirine Mabrouk',  '+21698000112', 'sirine@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true,
   '{"sms": true, "push": false}'::jsonb, '{"defaultSeats": 1}'::jsonb, null, now() - interval '7 months'),
  ('7970faa0-0e56-4a91-886e-000000000113', 'Anis Khelifi',    '+21698000113', 'anis@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true,
   '{"sms": true, "push": true}'::jsonb, '{"defaultSeats": 3}'::jsonb, null, now() - interval '11 months'),
  ('7a70fc34-d633-46b7-8081-000000000114', 'Rania Bouzid',    '+21698000114', 'rania@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true,
   '{"sms": false, "push": true}'::jsonb, '{"defaultSeats": 2}'::jsonb, null, now() - interval '5 months'),
  ('7b70fdc8-b8fd-4b12-8016-000000000115', 'Hatem Jelassi',   '+21698000115', 'hatem@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true,
   '{"sms": true, "push": true, "marketing": true}'::jsonb, '{"defaultSeats": 1}'::jsonb, null, now() - interval '3 months'),
  ('7c70ff58-9d86-4c02-8887-000000000116', 'Ines Chaabane',   '+21698000116', 'ines@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true,
   '{"sms": true, "push": true}'::jsonb, '{"defaultSeats": 2}'::jsonb, jsonb_build_object('provider', 'flouci', 'account', 'FL-9930-4412', 'updated_at', to_char((now() - interval '7 months 12 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')), now() - interval '26 months'),
  ('7d7100ec-e6e8-4904-8c0a-000000000117', 'Walid Ferchichi', '+21698000117', 'walid@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true,
   '{"sms": true, "push": true}'::jsonb, '{"defaultSeats": 1}'::jsonb, null, now() - interval '2 months'),
  ('6e70e950-4768-4b6b-88dc-000000000118', 'Nour Belhadj',    '+21698000118', 'nour@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true,
   '{"sms": true, "push": true}'::jsonb, '{"defaultSeats": 4}'::jsonb, null, now() - interval '6 weeks'),
  -- Drivers -------------------------------------------------------------------
  ('f16de5f0-24f0-4f38-8800-000000000102', 'Khaled Trabelsi', '+21622334455', 'khaled@example.tn', 'driver', crypt('Driver1234', gen_salt('bf')), true,
   '{"sms": true, "push": true}'::jsonb, '{}'::jsonb, '{"provider": "konnect", "account": "KONNECT-XXXX-1234"}'::jsonb, now() - interval '20 months'),
  ('7a733acc-60e0-4585-84c8-000000000121', 'Sami Gharsalli',  '+21622000121', 'sami@example.tn', 'driver', crypt('Driver1234', gen_salt('bf')), true,
   '{"sms": true, "push": true}'::jsonb, '{}'::jsonb, '{"provider": "konnect", "account": "KONNECT-XXXX-3311"}'::jsonb, now() - interval '15 months'),
  ('7b733c60-80ac-44bb-8c5e-000000000122', 'Fethi Naceur',    '+21622000122', 'fethi@example.tn', 'driver', crypt('Driver1234', gen_salt('bf')), true,
   '{"sms": true, "push": true}'::jsonb, '{}'::jsonb, '{"provider": "flouci", "account": "FL-5521-7788"}'::jsonb, now() - interval '18 months'),
  ('7c733df0-3890-4242-8810-000000000123', 'Lotfi Ben Amor',  '+21622000123', 'lotfi@example.tn', 'driver', crypt('Driver1234', gen_salt('bf')), true,
   '{"sms": true, "push": true}'::jsonb, '{}'::jsonb, '{"provider": "konnect", "account": "KONNECT-XXXX-9090"}'::jsonb, now() - interval '8 months'),
  ('7d733f84-f595-4ca3-802d-000000000124', 'Marwen Sliti',    '+21622000124', 'marwen@example.tn', 'driver', crypt('Driver1234', gen_salt('bf')), true,
   '{"sms": true, "push": true}'::jsonb, '{}'::jsonb, null, now() - interval '3 weeks'),
  ('7e734118-4ca5-4c6d-80d9-000000000125', 'Bilel Saidi',     '+21622000125', 'bilel@example.tn', 'driver', crypt('Driver1234', gen_salt('bf')), true,
   '{"sms": true, "push": true}'::jsonb, '{}'::jsonb, null, now() - interval '2 months'),
  -- Admins --------------------------------------------------------------------
  ('f26de784-e8c3-497c-80ef-000000000103', 'Admin Ops',     '+21655000000', 'ops@louagi.tn', 'admin', crypt('AdminLou2026', gen_salt('bf')), true,
   '{"sms": true, "push": true}'::jsonb, '{}'::jsonb, null, now() - interval '24 months'),
  ('81758468-cddf-4057-8093-000000000131', 'Leila Hammami',  '+21655000131', 'leila@louagi.tn', 'admin', crypt('AdminLou2026', gen_salt('bf')), true,
   '{"sms": true, "push": true}'::jsonb, '{}'::jsonb, null, now() - interval '10 months'),
  -- Extra demo passengers (denser dataset) -----------------------------------
  ('5fcf1e10-a34a-41a3-8079-694a40897d38', 'Amine Khedher', '+21697000201', 'amine@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{"defaultSeats":2}'::jsonb, null, now() - interval '4 months'),
  ('5ecf1c7e-336a-42ff-8e7c-8ba408cd28c2', 'Salma Tlili', '+21697000202', 'salma@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{"defaultSeats":1}'::jsonb, '{"provider":"flouci","account":"FL-3120-7741"}'::jsonb, now() - interval '7 months'),
  ('5dcf1aec-7513-4358-8e83-3bde9bdf0dbf', 'Karim Zouari', '+21697000203', 'karimz@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{"defaultSeats":3}'::jsonb, null, now() - interval '2 months'),
  ('5ccf1958-cb0a-4927-8c28-93ecfcc5147e', 'Dorra Hamdi', '+21697000204', 'dorra@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{"defaultSeats":1}'::jsonb, null, now() - interval '30 days'),
  ('63cf245c-0a19-4804-8c28-785edc47d8e6', 'Ramzi Aouadi', '+21697000205', 'ramzi@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{"defaultSeats":2}'::jsonb, null, now() - interval '5 months'),
  ('62cf22ca-0e69-4c92-8009-96b475b0b17d', 'Maha Toumi', '+21697000206', 'maha@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{"defaultSeats":1}'::jsonb, '{"provider":"flouci","account":"FL-8890-1123"}'::jsonb, now() - interval '10 months'),
  ('61cf2138-de5f-45ec-8833-6d1f449b2984', 'Skander Riahi', '+21697000207', 'skander@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{"defaultSeats":4}'::jsonb, null, now() - interval '3 months'),
  ('60cf1fa4-53ee-4be0-88f0-4a078dc7d035', 'Emna Dridi', '+21697000208', 'emna@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{"defaultSeats":1}'::jsonb, null, now() - interval '45 days'),
  ('57cf1178-856a-4eea-82a6-bc84249324d2', 'Bassem Kacem', '+21697000209', 'bassem@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{"defaultSeats":2}'::jsonb, null, now() - interval '8 months'),
  ('56cf0fe6-ad5e-496d-80f2-a1be9b07eadd', 'Cyrine Lahmar', '+21697000210', 'cyrine@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{"defaultSeats":1}'::jsonb, null, now() - interval '1 month'),
  ('8e098ec8-e39c-4c95-8047-bb83dc0a74e6', 'Aymen Mejri', '+21697000211', 'aymen@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{"defaultSeats":3}'::jsonb, null, now() - interval '6 months'),
  ('8f09905c-c729-4b85-8222-532dd4365315', 'Olfa Brahmi', '+21697000212', 'olfa@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{"defaultSeats":2}'::jsonb, '{"provider":"flouci","account":"FL-5567-9982"}'::jsonb, now() - interval '9 months'),
  ('8c098ba4-8eb7-4c96-8856-cd38a1774f31', 'Wassim Chebbi', '+21697000213', 'wassim@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{"defaultSeats":1}'::jsonb, null, now() - interval '20 days'),
  ('8d098d38-b83d-42d4-88f5-464764f5480a', 'Sabrine Ayari', '+21697000214', 'sabrine@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{"defaultSeats":2}'::jsonb, null, now() - interval '11 months'),
  ('8a098880-6185-4295-809d-d194649d1fa3', 'Hamza Guesmi', '+21697000215', 'hamza@example.tn', 'passenger', crypt('Passenger1', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{"defaultSeats":1}'::jsonb, null, now() - interval '5 weeks'),
  -- Extra demo drivers --------------------------------------------------------
  ('c4677add-4e69-44b4-8893-2b178d314bd8', 'Nizar Oueslati', '+21623000301', 'nizar@example.tn', 'driver', crypt('Driver1234', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{}'::jsonb, '{"provider":"konnect","account":"KONNECT-XXXX-4501"}'::jsonb, now() - interval '16 months'),
  ('c367794a-400c-4af9-8ecb-d86eb478d7fc', 'Tarek Mansour', '+21623000302', 'tarek@example.tn', 'driver', crypt('Driver1234', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{}'::jsonb, '{"provider":"flouci","account":"FL-4502-3310"}'::jsonb, now() - interval '13 months'),
  ('c26777b7-620d-4f31-887a-6fcca0a9d7cb', 'Slim Bouaziz', '+21623000303', 'slim@example.tn', 'driver', crypt('Driver1234', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{}'::jsonb, '{"provider":"konnect","account":"KONNECT-XXXX-4503"}'::jsonb, now() - interval '11 months'),
  ('c1677624-bb84-4acc-8a1d-2188f8bad50b', 'Mehdi Karoui', '+21623000304', 'mehdik@example.tn', 'driver', crypt('Driver1234', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{}'::jsonb, '{"provider":"flouci","account":"FL-4504-6677"}'::jsonb, now() - interval '9 months'),
  ('c0677491-b702-4f12-8c21-79cfac29e509', 'Anouar Hidri', '+21623000305', 'anouar@example.tn', 'driver', crypt('Driver1234', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{}'::jsonb, '{"provider":"konnect","account":"KONNECT-XXXX-4505"}'::jsonb, now() - interval '7 months'),
  ('bf6772fe-dc94-4507-800f-9410e8c8cd50', 'Zied Khalil', '+21623000306', 'zied@example.tn', 'driver', crypt('Driver1234', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{}'::jsonb, '{"provider":"flouci","account":"FL-4506-2231"}'::jsonb, now() - interval '5 months'),
  ('be67716b-8e6c-490c-8a8f-dc733893587f', 'Houssem Daldoul', '+21623000307', 'houssem@example.tn', 'driver', crypt('Driver1234', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{}'::jsonb, null, now() - interval '40 days'),
  ('bd676fd8-bebb-4099-8061-7b986c79eed7', 'Adel Mhiri', '+21623000308', 'adel@example.tn', 'driver', crypt('Driver1234', gen_salt('bf')), true, '{"sms":true,"push":true}'::jsonb, '{}'::jsonb, null, now() - interval '70 days')
on conflict (id) do update set
  full_name = excluded.full_name, phone_number = excluded.phone_number, email = excluded.email,
  role = excluded.role, password_hash = excluded.password_hash, is_active = excluded.is_active,
  notifications = excluded.notifications, preferences = excluded.preferences,
  payment_account = excluded.payment_account, created_at = excluded.created_at;

-- ════════════════════════════════════════════════════════════════════════════
-- §2 Route catalogue — 21 inter-city routes (government-set base price)
-- ════════════════════════════════════════════════════════════════════════════
insert into public.routes (id, origin_city, destination_city, distance_km, estimated_duration_min, base_price) values
  ('d4b877d4-5108-42c8-8e7f-000000000201', 'Tunis',    'Sfax',     270, 195, 22),
  ('d5b87968-7d11-4e24-8002-000000000202', 'Tunis',    'Sousse',   140, 110, 12),
  ('d6b87af8-d14b-422f-8022-000000000203', 'Tunis',    'Bizerte',   65,  60,  6),
  ('d7b87c8c-23ed-4b97-8037-000000000204', 'Sfax',     'Gabes',    135, 100, 11),
  ('d8b87e20-333c-44de-883d-000000000205', 'Sousse',   'Monastir',  25,  30,  4),
  ('d9b87fb0-1dca-4115-8aa9-000000000206', 'Tunis',    'Hammamet',  65,  55,  6),
  ('dab88144-482e-4ac9-80b4-000000000207', 'Tunis',    'Kairouan', 155, 130, 13),
  ('dbb882d8-fea4-450a-8012-000000000208', 'Sfax',     'Tunis',    270, 195, 22),
  ('dcb8846c-5406-4d04-80bd-000000000209', 'Tunis',    'Nabeul',    67,  60,  6),
  ('5abb895c-540f-4217-88dc-000000000210', 'Sousse',   'Sfax',     130, 105, 11),
  ('5bbb8af0-0e6c-4a13-8c2d-000000000211', 'Gabes',    'Medenine',  75,  70,  7),
  ('5cbb8c80-c524-4701-880b-000000000212', 'Tunis',    'Le Kef',   175, 150, 15),
  ('5dbb8e14-87b1-44aa-88d9-000000000213', 'Kairouan', 'Sfax',     130, 110, 11),
  -- Extra routes --------------------------------------------------------------
  ('af0bdc98-c8f0-4463-80ff-50f37bb94b3b', 'Tunis', 'Gabes', 405, 300, 32),
  ('b00bde2b-ea0a-4ffb-8062-6bad144a0407', 'Tunis', 'Gafsa', 360, 270, 29),
  ('b10bdfbe-7aa8-48df-8035-91997cae3694', 'Sfax', 'Sousse', 130, 105, 11),
  ('b20be151-e26d-4535-8024-b16d44d74532', 'Sousse', 'Tunis', 140, 110, 12),
  ('b30be2e4-bf8a-4e43-8001-16558474ddca', 'Tunis', 'Tozeur', 430, 330, 35),
  ('b40be477-0a10-4f66-87db-082e08b97a66', 'Nabeul', 'Tunis', 67, 60, 6),
  ('b50be60a-b14b-4f2f-8821-09d9146431f0', 'Bizerte', 'Tunis', 65, 60, 6),
  ('b60be79d-d689-4d9f-803e-ef677cff6047', 'Monastir', 'Sousse', 25, 30, 4)
on conflict (origin_city, destination_city) do update set
  id = excluded.id, distance_km = excluded.distance_km,
  estimated_duration_min = excluded.estimated_duration_min, base_price = excluded.base_price;

-- ════════════════════════════════════════════════════════════════════════════
-- §3 Reference catalogues (loaded BEFORE reservations so create_reservation-style
--    tier pricing resolves correctly when we generate bookings below).
-- ════════════════════════════════════════════════════════════════════════════
-- Popular-route shortcuts shown on Home (was LandingScreen `POPULAR`).
update public.routes set is_popular = false;
update public.routes set is_popular = true
where (origin_city, destination_city) in (
  ('Tunis', 'Sfax'), ('Tunis', 'Sousse'), ('Sfax', 'Gabes'),
  ('Tunis', 'Hammamet'), ('Tunis', 'Nabeul'));

-- App configuration (read by both client and server).
insert into public.app_config (key, value) values
  ('delivery_pricing', '{"price": 10, "driver_fee": 8, "platform_fee": 2}'::jsonb),
  ('reservation_fee',  '{"platform_fee": 1, "driver_fee": 2}'::jsonb),
  ('support',          '{"email": "support@louagi.tn", "phone": "+216 71 000 000", "hours": "08:00-20:00"}'::jsonb),
  ('app',              '{"min_version": "1.4.0", "maintenance": false}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

-- Achievement catalogue (was Membership `ACHIEVEMENTS` + server thresholds).
insert into public.achievements (id, i18n_key, icon, threshold_type, threshold, sort_order) values
  ('firstTrip', 'achFirstTrip', 'flag',              'trips',           1,  0),
  ('ecoRider',  'achEcoRider',  'eco',               'trips',           5,  1),
  ('explorer',  'achExplorer',  'explore',           'distinct_routes', 3,  2),
  ('tenTrips',  'ach10Trips',   'military-tech',     'trips',           10, 3),
  ('veteran',   'achVeteran',   'workspace-premium', 'trips',           50, 4)
on conflict (id) do update set
  i18n_key = excluded.i18n_key, icon = excluded.icon, threshold_type = excluded.threshold_type,
  threshold = excluded.threshold, sort_order = excluded.sort_order;

-- Loyalty tier ladder (was Membership/server `TIERS`). min_points/discount_pct
-- are authoritative — public.create_reservation reads discount_pct here to price
-- bookings; i18n_key/perks are presentation hints. Discount caps at 15%.
insert into public.tiers (id, i18n_key, min_points, discount_pct, perks, sort_order) values
  ('bronze',   'tierBronze',   0,     0,  '{}',                                       0),
  ('silver',   'tierSilver',   500,   5,  '{}',                                       1),
  ('gold',     'tierGold',     1500,  10, '{}',                                       2),
  ('platinum', 'tierPlatinum', 3000,  15, '{}',                                       3),
  ('diamond',  'tierDiamond',  6000,  15, '{perkPrioritySupport}',                    4),
  ('elite',    'tierElite',    12000, 15, '{perkPrioritySupport,perkPriorityAccess}', 5)
on conflict (id) do update set
  i18n_key = excluded.i18n_key, min_points = excluded.min_points,
  discount_pct = excluded.discount_pct, perks = excluded.perks, sort_order = excluded.sort_order;

-- ════════════════════════════════════════════════════════════════════════════
-- §4 Driver records (10 verified · 2 pending · 2 rejected) + admins
-- ════════════════════════════════════════════════════════════════════════════
insert into public.drivers (
  id, user_id, plate_number, id_card_number, license_number, vehicle_brand, vehicle_model,
  seat_count, status, verified_at, rejection_reason, license_expires_at, id_expires_at,
  payout_account, rating, trips_completed, national_id_verified, criminal_record_check
) values
  ('414905e4-e674-4b93-8079-000000000301', 'f16de5f0-24f0-4f38-8800-000000000102', '123 TUN 4567', '12345678', 'TN-DL-998877', 'Peugeot',    '301',    5, 'verified', now() - interval '20 months', null, now() + interval '365 days', now() + interval '720 days', 'KONNECT-XXXX-1234', 4.80, 0, true,  true),
  ('484b4f80-c87d-416a-8849-000000000311', '7a733acc-60e0-4585-84c8-000000000121', '145 TUN 8890', '23456789', 'TN-DL-771122', 'Volkswagen', 'Caddy',  4, 'verified', now() - interval '15 months', null, now() + interval '300 days', now() + interval '640 days', 'KONNECT-XXXX-3311', 4.60, 0, true,  true),
  ('494b5110-14c6-4d5d-8a1a-000000000312', '7b733c60-80ac-44bb-8c5e-000000000122', '210 TUN 3321', '34567890', 'TN-DL-334455', 'Mercedes',   'Vito',   8, 'verified', now() - interval '18 months', null, now() + interval '410 days', now() + interval '800 days', 'FL-5521-7788',      4.90, 0, true,  true),
  ('4a4b52a4-d193-4aff-8a04-000000000313', '7c733df0-3890-4242-8810-000000000123', '178 TUN 5567', '45678901', 'TN-DL-556677', 'Peugeot',    'Expert', 5, 'verified', now() - interval '8 months',  null, now() + interval '250 days', now() + interval '590 days', 'KONNECT-XXXX-9090', 4.70, 0, true,  true),
  ('434b47a0-927b-4cb0-88d2-000000000314', '7d733f84-f595-4ca3-802d-000000000124', '199 TUN 1102', '56789012', 'TN-DL-889900', 'Renault',    'Trafic', 4, 'pending',  null,                          null, now() + interval '200 days', now() + interval '500 days', null, null, 0, false, false),
  ('444b4934-4504-40d3-8040-000000000315', '7e734118-4ca5-4c6d-80d9-000000000125', '233 TUN 7745', '67890123', 'TN-DL-112233', 'Isuzu',      'Novo',   4, 'rejected', null, 'Driving license document was expired at submission', now() - interval '30 days', now() + interval '400 days', null, null, 0, false, false),
  -- Extra driver records ------------------------------------------------------
  ('f5382d70-ea9d-40e8-883e-ae8684a427ca', 'c4677add-4e69-44b4-8893-2b178d314bd8', '301 TUN 2244', '70010011', 'TN-DL-450122', 'Hyundai', 'H1', 7, 'verified', now() - interval '16 months', null, now() + interval '330 days', now() + interval '700 days', 'KONNECT-XXXX-4501', 4.70, 0, true, true),
  ('f6382f04-df9b-4330-88f9-639414b9353a', 'c367794a-400c-4af9-8ecb-d86eb478d7fc', '312 TUN 8841', '70010012', 'TN-DL-450233', 'Toyota', 'HiAce', 8, 'verified', now() - interval '13 months', null, now() + interval '290 days', now() + interval '640 days', 'FL-4502-3310', 4.85, 0, true, true),
  ('f7383098-155a-4930-88c8-cd297c010d5b', 'c26777b7-620d-4f31-887a-6fcca0a9d7cb', '266 TUN 1190', '70010013', 'TN-DL-450344', 'Peugeot', 'Boxer', 6, 'verified', now() - interval '11 months', null, now() + interval '360 days', now() + interval '720 days', 'KONNECT-XXXX-4503', 4.60, 0, true, true),
  ('f8383228-699d-464e-808a-e6a8dcca833e', 'c1677624-bb84-4acc-8a1d-2188f8bad50b', '188 TUN 5523', '70010014', 'TN-DL-450455', 'Citroen', 'Jumpy', 5, 'verified', now() - interval '9 months', null, now() + interval '410 days', now() + interval '800 days', 'FL-4504-6677', 4.90, 0, true, true),
  ('f93833bc-0063-4d8c-8258-7709fc9e366f', 'c0677491-b702-4f12-8c21-79cfac29e509', '142 TUN 9087', '70010015', 'TN-DL-450566', 'Renault', 'Trafic', 4, 'verified', now() - interval '7 months', null, now() + interval '250 days', now() + interval '590 days', 'KONNECT-XXXX-4505', 4.55, 0, true, true),
  ('fa383550-019b-41de-88c4-7d9b145eec82', 'bf6772fe-dc94-4507-800f-9410e8c8cd50', '233 TUN 4419', '70010016', 'TN-DL-450677', 'Fiat', 'Scudo', 5, 'verified', now() - interval '5 months', null, now() + interval '300 days', now() + interval '650 days', 'FL-4506-2231', 4.75, 0, true, true),
  ('fb3836e0-ef3f-408f-8287-62b00c83123d', 'be67716b-8e6c-490c-8a8f-dc733893587f', '199 TUN 7012', '70010017', 'TN-DL-450788', 'Volkswagen', 'Transporter', 6, 'pending', null, null, now() + interval '220 days', now() + interval '540 days', null, null, 0, false, false),
  ('fc383874-4ad7-4f49-88ac-1e641b51cd6d', 'bd676fd8-bebb-4099-8061-7b986c79eed7', '155 TUN 3398', '70010018', 'TN-DL-450899', 'Ford', 'Transit', 4, 'rejected', null, 'Vehicle registration did not match the plate on file', now() + interval '-20 days', now() + interval '480 days', null, null, 0, false, false)
on conflict (user_id) do update set
  plate_number = excluded.plate_number, id_card_number = excluded.id_card_number,
  license_number = excluded.license_number, vehicle_brand = excluded.vehicle_brand,
  vehicle_model = excluded.vehicle_model, seat_count = excluded.seat_count,
  status = excluded.status, verified_at = excluded.verified_at,
  rejection_reason = excluded.rejection_reason, license_expires_at = excluded.license_expires_at,
  id_expires_at = excluded.id_expires_at, payout_account = excluded.payout_account,
  rating = excluded.rating, trips_completed = excluded.trips_completed,
  national_id_verified = excluded.national_id_verified, criminal_record_check = excluded.criminal_record_check;

insert into public.admins (id, user_id, permissions) values
  ('42490778-5ef1-4ae8-82fe-000000000302', 'f26de784-e8c3-497c-80ef-000000000103', '["*"]'::jsonb),
  ('43490908-199e-4ca3-8000-000000000303', '81758468-cddf-4057-8093-000000000131', '["users:read","drivers:read","drivers:write","payments:read","rides:read"]'::jsonb)
on conflict (user_id) do update set permissions = excluded.permissions;

-- ════════════════════════════════════════════════════════════════════════════
-- §5 KYC documents + sessions + refresh tokens
-- ════════════════════════════════════════════════════════════════════════════
insert into public.documents (id, user_id, kind, name, mime, size_bytes, storage_path, uploaded_at)
select pg_temp.sid('doc-' || u.id::text || '-' || k.kind),
       u.id, k.kind::document_kind, k.label, 'application/pdf', k.sz,
       'kyc/' || u.id::text || '/' || k.kind || '.pdf', now() - interval '60 days'
from public.users u
cross join (values
  ('id_card', 'National ID card.pdf',     240000),
  ('license', 'Driving license.pdf',      185000),
  ('vehicle', 'Vehicle registration.pdf', 321000)
) k(kind, label, sz)
where u.role = 'driver'
on conflict (id) do update set name = excluded.name, size_bytes = excluded.size_bytes;

insert into public.driver_sessions (id, driver_id, device_name, os_name, ip_address, is_revoked, last_active_at, created_at)
select pg_temp.sid('dsess-' || u.id::text || '-' || s.k::text),
       u.id, s.dev, s.os, s.ip, s.revoked,
       now() - (s.k || ' hours')::interval, now() - (s.k || ' days')::interval
from public.users u
cross join (values
  (1, 'Pixel 7',    'Android 14', '41.226.11.10',  false),
  (2, 'iPhone 13',  'iOS 17',     '197.15.3.44',   false),
  (3, 'Galaxy A52', 'Android 13', '102.156.7.9',   true)
) s(k, dev, os, ip, revoked)
where u.role = 'driver'
on conflict (id) do update set is_revoked = excluded.is_revoked, last_active_at = excluded.last_active_at;

insert into public.user_sessions (session_id, user_id, device_info, ip_address, expires_at, last_active_at, created_at) values
  (pg_temp.sid('usess-101'), 'f06de460-2e24-4067-84aa-000000000101', 'iPhone 13 · iOS 17',   '197.15.3.44',        now() + interval '20 days', now() - interval '1 hour',      now() - interval '5 days'),
  (pg_temp.sid('usess-116'), '7c70ff58-9d86-4c02-8887-000000000116', 'Pixel 8 · Android 14', '41.226.9.71',        now() + interval '20 days', now() - interval '3 hours',     now() - interval '8 days'),
  (pg_temp.sid('usess-102'), 'f16de5f0-24f0-4f38-8800-000000000102', 'Galaxy S23 · Android', '102.156.7.9',        now() + interval '20 days', now() - interval '20 minutes',  now() - interval '2 days'),
  (pg_temp.sid('usess-103'), 'f26de784-e8c3-497c-80ef-000000000103', 'Chrome · macOS',       '160.155.10.4',       now() + interval '7 days',  now() - interval '10 minutes',  now() - interval '1 day')
on conflict (session_id) do update set expires_at = excluded.expires_at, last_active_at = excluded.last_active_at;

insert into public.refresh_tokens (jti, user_id, expires_at, created_at) values
  ('seed-rt-101', 'f06de460-2e24-4067-84aa-000000000101', now() + interval '30 days', now() - interval '5 days'),
  ('seed-rt-116', '7c70ff58-9d86-4c02-8887-000000000116', now() + interval '30 days', now() - interval '8 days'),
  ('seed-rt-102', 'f16de5f0-24f0-4f38-8800-000000000102', now() + interval '30 days', now() - interval '2 days')
on conflict (jti) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- §6 Rides
-- ════════════════════════════════════════════════════════════════════════════
-- 6.1 Fixed demo rides for Mariem (scheduled). available_seats recomputed in §10.
insert into public.rides (id, driver_id, route_id, departure_time, total_seats, available_seats, price_per_seat, status, created_at) values
  ('c71fe897-b8bc-44d7-8edf-000000000401', '414905e4-e674-4b93-8079-000000000301', 'd4b877d4-5108-42c8-8e7f-000000000201', date_trunc('day', now()) + interval '1 day 8 hours 30 minutes', 4, 4, 22, 'scheduled', now()),
  ('c81fea2a-446b-4cb6-8805-000000000402', '414905e4-e674-4b93-8079-000000000301', 'd5b87968-7d11-4e24-8002-000000000202', date_trunc('day', now()) + interval '2 days 10 hours',          4, 4, 12, 'scheduled', now()),
  ('c91febbd-6d3a-4c5e-8697-000000000403', '414905e4-e674-4b93-8079-000000000301', 'dab88144-482e-4ac9-80b4-000000000207', date_trunc('day', now()) + interval '3 days 13 hours',          5, 5, 13, 'scheduled', now())
on conflict (id) do update set
  driver_id = excluded.driver_id, route_id = excluded.route_id, departure_time = excluded.departure_time,
  total_seats = excluded.total_seats, available_seats = excluded.available_seats,
  price_per_seat = excluded.price_per_seat, status = excluded.status, created_at = excluded.created_at;

-- 6.2 Live, in-progress rides happening "now" (for delivery tracking + GPS).
insert into public.rides (id, driver_id, route_id, departure_time, total_seats, available_seats, price_per_seat, status, accepts_delivery, created_at) values
  ('ae21ffd3-d8ba-493e-883f-000000000411', '414905e4-e674-4b93-8079-000000000301', 'd4b877d4-5108-42c8-8e7f-000000000201', now() - interval '45 minutes', 5, 5, 22, 'in_progress', true, now() - interval '2 days'),
  ('af220166-d89d-4b1d-8023-000000000412', '484b4f80-c87d-416a-8849-000000000311', '5abb895c-540f-4217-88dc-000000000210', now() - interval '30 minutes', 4, 4, 11, 'in_progress', true, now() - interval '2 days'),
  ('b02202f9-428e-415d-8814-000000000413', '494b5110-14c6-4d5d-8a1a-000000000312', 'd9b87fb0-1dca-4115-8aa9-000000000206', now() - interval '50 minutes', 8, 8,  6, 'in_progress', true, now() - interval '2 days')
on conflict (id) do update set
  driver_id = excluded.driver_id, route_id = excluded.route_id, departure_time = excluded.departure_time,
  total_seats = excluded.total_seats, available_seats = excluded.available_seats,
  price_per_seat = excluded.price_per_seat, status = excluded.status,
  accepts_delivery = excluded.accepts_delivery, created_at = excluded.created_at;

-- 6.3 NEXT 30 DAYS of scheduled rides — ~90 across 4 verified drivers, 13 routes,
--     7 daily time-slots. price_per_seat = the route's government base price.
insert into public.rides (id, driver_id, route_id, departure_time, total_seats, available_seats, price_per_seat, status, accepts_delivery, max_delivery_slots, created_at)
select
  pg_temp.sid('ride-future-' || g::text),
  (array['414905e4-e674-4b93-8079-000000000301','484b4f80-c87d-416a-8849-000000000311','494b5110-14c6-4d5d-8a1a-000000000312','4a4b52a4-d193-4aff-8a04-000000000313']::uuid[])[1 + (g % 4)],
  (array['d4b877d4-5108-42c8-8e7f-000000000201','d5b87968-7d11-4e24-8002-000000000202','d6b87af8-d14b-422f-8022-000000000203','d7b87c8c-23ed-4b97-8037-000000000204','d8b87e20-333c-44de-883d-000000000205','d9b87fb0-1dca-4115-8aa9-000000000206','dab88144-482e-4ac9-80b4-000000000207','dbb882d8-fea4-450a-8012-000000000208','dcb8846c-5406-4d04-80bd-000000000209','5abb895c-540f-4217-88dc-000000000210','5bbb8af0-0e6c-4a13-8c2d-000000000211','5cbb8c80-c524-4701-880b-000000000212','5dbb8e14-87b1-44aa-88d9-000000000213']::uuid[])[1 + (g % 13)],
  date_trunc('day', now()) + ((g % 30) || ' days')::interval + ((6 + (g % 7) * 2) || ' hours')::interval + (((g % 2) * 30) || ' minutes')::interval,
  (array[5,4,8,5]::int[])[1 + (g % 4)],
  (array[5,4,8,5]::int[])[1 + (g % 4)],
  (array[22,12,6,11,4,6,13,22,6,11,7,15,11]::numeric[])[1 + (g % 13)],
  'scheduled',
  (g % 5 <> 0),
  3,
  now() - ((g % 10) || ' days')::interval
from generate_series(1, 90) as g
on conflict (id) do update set
  driver_id = excluded.driver_id, route_id = excluded.route_id, departure_time = excluded.departure_time,
  total_seats = excluded.total_seats, available_seats = excluded.available_seats,
  price_per_seat = excluded.price_per_seat, status = excluded.status,
  accepts_delivery = excluded.accepts_delivery, created_at = excluded.created_at;

-- 6.4 Completed ride HISTORY, shaped per passenger so each lands on a chosen tier
--     (trip count → loyalty points). One completed ride + one confirmed booking
--     per trip. driver/route/price vary deterministically by (seed, g).
insert into public.rides (id, driver_id, route_id, departure_time, total_seats, available_seats, price_per_seat, status, accepts_delivery, created_at)
select
  pg_temp.sid('ride-hist-' || plan.pid::text || '-' || s.g::text),
  (array['414905e4-e674-4b93-8079-000000000301','484b4f80-c87d-416a-8849-000000000311','494b5110-14c6-4d5d-8a1a-000000000312','4a4b52a4-d193-4aff-8a04-000000000313']::uuid[])[1 + ((plan.seed * 7 + s.g) % 4)],
  (array['d4b877d4-5108-42c8-8e7f-000000000201','d5b87968-7d11-4e24-8002-000000000202','d6b87af8-d14b-422f-8022-000000000203','d7b87c8c-23ed-4b97-8037-000000000204','d8b87e20-333c-44de-883d-000000000205','d9b87fb0-1dca-4115-8aa9-000000000206','dab88144-482e-4ac9-80b4-000000000207','dbb882d8-fea4-450a-8012-000000000208','dcb8846c-5406-4d04-80bd-000000000209','5abb895c-540f-4217-88dc-000000000210','5bbb8af0-0e6c-4a13-8c2d-000000000211','5cbb8c80-c524-4701-880b-000000000212','5dbb8e14-87b1-44aa-88d9-000000000213']::uuid[])[1 + ((plan.seed * 7 + s.g) % 13)],
  date_trunc('day', now()) - ((3 + s.g * 3 + plan.seed * 2) || ' days')::interval + interval '9 hours',
  (array[5,4,8,5]::int[])[1 + ((plan.seed * 7 + s.g) % 4)],
  (array[5,4,8,5]::int[])[1 + ((plan.seed * 7 + s.g) % 4)],
  (array[22,12,6,11,4,6,13,22,6,11,7,15,11]::numeric[])[1 + ((plan.seed * 7 + s.g) % 13)],
  'completed', true,
  date_trunc('day', now()) - ((7 + s.g * 3 + plan.seed * 2) || ' days')::interval
from (values
  ('7c70ff58-9d86-4c02-8887-000000000116'::uuid, 65, 1),   -- Ines    → Diamond
  ('f06de460-2e24-4067-84aa-000000000101'::uuid, 30, 0),   -- Mariem  → Platinum
  ('7770f77c-23bc-480c-886d-000000000111'::uuid, 18, 2),   -- Yassine → Gold
  ('7870f910-9c85-40ce-8802-000000000112'::uuid, 14, 3),   -- Sirine  → Gold
  ('7970faa0-0e56-4a91-886e-000000000113'::uuid,  5, 4),   -- Anis    → Silver
  ('7a70fc34-d633-46b7-8081-000000000114'::uuid,  4, 5),   -- Rania   → Silver
  ('7b70fdc8-b8fd-4b12-8016-000000000115'::uuid,  3, 6),   -- Hatem   → Bronze
  ('7d7100ec-e6e8-4904-8c0a-000000000117'::uuid,  2, 7)    -- Walid   → Bronze
) plan(pid, n, seed)
cross join lateral generate_series(1, plan.n) as s(g)
on conflict (id) do update set status = excluded.status, departure_time = excluded.departure_time;

-- 6.5 A handful of CANCELLED past rides so refunds + the "cancelled" filter and
--     admin refund views have data.
insert into public.rides (id, driver_id, route_id, departure_time, total_seats, available_seats, price_per_seat, status, created_at)
select
  pg_temp.sid('ride-cancel-' || g::text),
  (array['414905e4-e674-4b93-8079-000000000301','484b4f80-c87d-416a-8849-000000000311','494b5110-14c6-4d5d-8a1a-000000000312','4a4b52a4-d193-4aff-8a04-000000000313']::uuid[])[1 + (g % 4)],
  (array['d4b877d4-5108-42c8-8e7f-000000000201','d5b87968-7d11-4e24-8002-000000000202','d6b87af8-d14b-422f-8022-000000000203','d7b87c8c-23ed-4b97-8037-000000000204','d8b87e20-333c-44de-883d-000000000205','d9b87fb0-1dca-4115-8aa9-000000000206','dab88144-482e-4ac9-80b4-000000000207','dbb882d8-fea4-450a-8012-000000000208','dcb8846c-5406-4d04-80bd-000000000209','5abb895c-540f-4217-88dc-000000000210','5bbb8af0-0e6c-4a13-8c2d-000000000211','5cbb8c80-c524-4701-880b-000000000212','5dbb8e14-87b1-44aa-88d9-000000000213']::uuid[])[1 + (g % 13)],
  date_trunc('day', now()) - ((2 + g * 4) || ' days')::interval + interval '11 hours',
  4, 4,
  (array[22,12,6,11,4,6,13,22,6,11,7,15,11]::numeric[])[1 + (g % 13)],
  'cancelled',
  date_trunc('day', now()) - ((6 + g * 4) || ' days')::interval
from generate_series(1, 12) as g
on conflict (id) do update set status = excluded.status;

-- ════════════════════════════════════════════════════════════════════════════
-- §6.6 EXTRA scheduled rides — ~210 more across ALL verified drivers and ALL
--      routes, spanning today → +30 days (now()-relative). Driver / seat count /
--      route / price are pulled live from the tables, so this scales with the
--      roster instead of hard-coding parallel arrays.
-- ════════════════════════════════════════════════════════════════════════════
with cfg as (
  select
    (select array_agg(id order by id)        from public.drivers where status = 'verified') as drv,
    (select array_agg(seat_count order by id) from public.drivers where status = 'verified') as seats,
    (select array_agg(id order by id)         from public.routes) as rts,
    (select array_agg(base_price order by id) from public.routes) as prc
)
insert into public.rides (id, driver_id, route_id, departure_time, total_seats, available_seats, price_per_seat, status, accepts_delivery, max_delivery_slots, created_at)
select
  pg_temp.sid('ride-extra-' || g::text),
  c.drv[1 + (g % array_length(c.drv, 1))],
  c.rts[1 + (g % array_length(c.rts, 1))],
  date_trunc('day', now()) + ((g % 30) || ' days')::interval + ((6 + (g % 7) * 2) || ' hours')::interval + (((g % 2) * 30) || ' minutes')::interval,
  c.seats[1 + (g % array_length(c.drv, 1))],
  c.seats[1 + (g % array_length(c.drv, 1))],
  c.prc[1 + (g % array_length(c.rts, 1))],
  'scheduled',
  (g % 5 <> 0),
  3,
  now() - ((g % 10) || ' days')::interval
from cfg c cross join generate_series(1, 210) as g
on conflict (id) do update set
  driver_id = excluded.driver_id, route_id = excluded.route_id, departure_time = excluded.departure_time,
  total_seats = excluded.total_seats, available_seats = excluded.available_seats,
  price_per_seat = excluded.price_per_seat, status = excluded.status,
  accepts_delivery = excluded.accepts_delivery, created_at = excluded.created_at;


-- ════════════════════════════════════════════════════════════════════════════
-- §7 Reservations
-- ════════════════════════════════════════════════════════════════════════════
-- 7.1 Fixed demo bookings for Mariem. 501 carries her Platinum 15% discount
--     (seat fare 44 − 6.60 + 3 fee = 40.40); 502 is a cancelled booking.
insert into public.reservations (id, user_id, ride_id, seats_booked, total_price, status, idempotency_key, booked_at, cancelled_at, discount_pct) values
  ('2bb9646b-e2fb-479e-88dd-000000000501', 'f06de460-2e24-4067-84aa-000000000101', 'c71fe897-b8bc-44d7-8edf-000000000401', 2, 40.40, 'confirmed', 'seed-passenger-upcoming',  now() - interval '2 hours', null,                        15),
  ('2cb965fe-c247-4551-86d8-000000000502', 'f06de460-2e24-4067-84aa-000000000101', 'c81fea2a-446b-4cb6-8805-000000000402', 1, 14.00, 'cancelled', 'seed-passenger-cancelled', now() - interval '1 day',   now() - interval '20 hours', 0)
on conflict (id) do update set
  user_id = excluded.user_id, ride_id = excluded.ride_id, seats_booked = excluded.seats_booked,
  total_price = excluded.total_price, status = excluded.status, idempotency_key = excluded.idempotency_key,
  booked_at = excluded.booked_at, cancelled_at = excluded.cancelled_at, discount_pct = excluded.discount_pct;

-- 7.2 Passengers currently travelling on the in-progress rides (411 has two).
insert into public.reservations (id, user_id, ride_id, seats_booked, total_price, status, idempotency_key, booked_at, discount_pct) values
  ('99be8ec3-c96a-452f-8874-000000000521', '7870f910-9c85-40ce-8802-000000000112', 'ae21ffd3-d8ba-493e-883f-000000000411', 2, 47.00, 'confirmed', 'seed-inprog-1', now() - interval '1 day', 0),
  ('9abe9056-3cec-4955-8eae-000000000522', '6e70e950-4768-4b6b-88dc-000000000118', 'ae21ffd3-d8ba-493e-883f-000000000411', 1, 25.00, 'confirmed', 'seed-inprog-2', now() - interval '1 day', 0),
  ('9bbe91e9-12f4-4f68-8ef9-000000000523', '7970faa0-0e56-4a91-886e-000000000113', 'af220166-d89d-4b1d-8023-000000000412', 1, 14.00, 'confirmed', 'seed-inprog-3', now() - interval '1 day', 0),
  ('9cbe937c-3724-4eb5-88d9-000000000524', '7a70fc34-d633-46b7-8081-000000000114', 'b02202f9-428e-415d-8814-000000000413', 2, 15.00, 'confirmed', 'seed-inprog-4', now() - interval '1 day', 0)
on conflict (id) do update set seats_booked = excluded.seats_booked, total_price = excluded.total_price, status = excluded.status;

-- 7.3 One confirmed booking per history ride (the owner of that history block).
insert into public.reservations (id, user_id, ride_id, seats_booked, total_price, status, idempotency_key, booked_at, discount_pct)
select
  pg_temp.sid('res-hist-' || plan.pid::text || '-' || s.g::text),
  plan.pid,
  pg_temp.sid('ride-hist-' || plan.pid::text || '-' || s.g::text),
  1 + (s.g % 2),
  (1 + (s.g % 2)) * (array[22,12,6,11,4,6,13,22,6,11,7,15,11]::numeric[])[1 + ((plan.seed * 7 + s.g) % 13)] + 3,
  'confirmed',
  'seed-res-hist-' || plan.pid::text || '-' || s.g::text,
  date_trunc('day', now()) - ((5 + s.g * 3 + plan.seed * 2) || ' days')::interval,
  0
from (values
  ('7c70ff58-9d86-4c02-8887-000000000116'::uuid, 65, 1),
  ('f06de460-2e24-4067-84aa-000000000101'::uuid, 30, 0),
  ('7770f77c-23bc-480c-886d-000000000111'::uuid, 18, 2),
  ('7870f910-9c85-40ce-8802-000000000112'::uuid, 14, 3),
  ('7970faa0-0e56-4a91-886e-000000000113'::uuid,  5, 4),
  ('7a70fc34-d633-46b7-8081-000000000114'::uuid,  4, 5),
  ('7b70fdc8-b8fd-4b12-8016-000000000115'::uuid,  3, 6),
  ('7d7100ec-e6e8-4904-8c0a-000000000117'::uuid,  2, 7)
) plan(pid, n, seed)
cross join lateral generate_series(1, plan.n) as s(g)
on conflict (id) do update set total_price = excluded.total_price;

-- 7.4 A second passenger on the first 8 of Ines's completed rides (so the driver
--     "passengers on this ride" view shows multi-passenger rides). Bookers are
--     limited to the already-high-tier travellers so the tier spread is undisturbed.
insert into public.reservations (id, user_id, ride_id, seats_booked, total_price, status, idempotency_key, booked_at, discount_pct)
select
  pg_temp.sid('res-hist2-' || g::text),
  (array['f06de460-2e24-4067-84aa-000000000101','7770f77c-23bc-480c-886d-000000000111','7870f910-9c85-40ce-8802-000000000112']::uuid[])[1 + (g % 3)],
  pg_temp.sid('ride-hist-7c70ff58-9d86-4c02-8887-000000000116-' || g::text),
  1,
  (array[22,12,6,11,4,6,13,22,6,11,7,15,11]::numeric[])[1 + ((7 + g) % 13)] + 3,
  'confirmed',
  'seed-res-hist2-' || g::text,
  date_trunc('day', now()) - ((8 + g * 3) || ' days')::interval,
  0
from generate_series(1, 8) as g
on conflict (id) do update set total_price = excluded.total_price;

-- 7.5 Cancelled bookings on the cancelled rides (⇒ refunded payments in §8).
insert into public.reservations (id, user_id, ride_id, seats_booked, total_price, status, idempotency_key, booked_at, cancelled_at, discount_pct)
select
  pg_temp.sid('res-cancel-' || g::text),
  (array['f06de460-2e24-4067-84aa-000000000101','7770f77c-23bc-480c-886d-000000000111','7870f910-9c85-40ce-8802-000000000112','7970faa0-0e56-4a91-886e-000000000113','7a70fc34-d633-46b7-8081-000000000114','7b70fdc8-b8fd-4b12-8016-000000000115','7c70ff58-9d86-4c02-8887-000000000116','7d7100ec-e6e8-4904-8c0a-000000000117','6e70e950-4768-4b6b-88dc-000000000118']::uuid[])[1 + (g % 9)],
  pg_temp.sid('ride-cancel-' || g::text),
  1 + (g % 2),
  (1 + (g % 2)) * (array[22,12,6,11,4,6,13,22,6,11,7,15,11]::numeric[])[1 + (g % 13)] + 3,
  'cancelled',
  'seed-res-cancel-' || g::text,
  date_trunc('day', now()) - ((4 + g * 4) || ' days')::interval,
  date_trunc('day', now()) - ((2 + g * 4) || ' days')::interval,
  0
from generate_series(1, 12) as g
on conflict (id) do update set status = excluded.status;

-- 7.6 Upcoming bookings on the NEXT-30-DAYS rides — every 3rd ride, one seat,
--     by the six regular travellers (the three occasional passengers keep only
--     their small history, so they stay Bronze/Silver). The booker's loyalty
--     tier is resolved from their now-complete history, so the seat-fare discount
--     is applied exactly like create_reservation — Silver 5%, Gold 10%, 15% cap.
with pts as (
  select user_id,
    count(*) filter (where status = 'confirmed') * 100
    + round(coalesce(sum(total_price) filter (where status <> 'cancelled'), 0))::int as points
  from public.reservations
  group by user_id
),
tiered as (
  select u.id as user_id,
    coalesce((select t.discount_pct from public.tiers t where t.min_points <= coalesce(p.points, 0) order by t.min_points desc limit 1), 0) as pct
  from public.users u
  left join pts p on p.user_id = u.id
  where u.role = 'passenger'
),
bookings as (
  select g,
    -- index by g/3 (not g) so all six travellers are hit; g%6 over multiples of
    -- 3 would only ever land on two of them.
    (array['f06de460-2e24-4067-84aa-000000000101','7770f77c-23bc-480c-886d-000000000111','7870f910-9c85-40ce-8802-000000000112','7970faa0-0e56-4a91-886e-000000000113','7a70fc34-d633-46b7-8081-000000000114','7c70ff58-9d86-4c02-8887-000000000116']::uuid[])[1 + ((g / 3) % 6)] as pid,
    pg_temp.sid('ride-future-' || g::text) as ride_id,
    (array[22,12,6,11,4,6,13,22,6,11,7,15,11]::numeric[])[1 + (g % 13)] as price
  from generate_series(1, 90) as g
  where g % 3 = 0
)
insert into public.reservations (id, user_id, ride_id, seats_booked, total_price, status, idempotency_key, booked_at, discount_pct)
select
  pg_temp.sid('res-future-' || b.g::text),
  b.pid, b.ride_id, 1,
  round(b.price * (1 - tr.pct / 100.0) + 3, 2),
  'confirmed',
  'seed-res-future-' || b.g::text,
  now() - ((b.g % 5) || ' days')::interval,
  tr.pct
from bookings b
join tiered tr on tr.user_id = b.pid
on conflict (id) do update set total_price = excluded.total_price, discount_pct = excluded.discount_pct;

-- ════════════════════════════════════════════════════════════════════════════
-- §7.7 EXTRA upcoming bookings on the §6.6 rides — every 2nd extra ride, booked
--      round-robin by ALL passengers, with the loyalty seat-fare discount applied
--      exactly like create_reservation (tier resolved from current points).
-- ════════════════════════════════════════════════════════════════════════════
with pts as (
  select user_id,
    count(*) filter (where status = 'confirmed') * 100
    + round(coalesce(sum(total_price) filter (where status <> 'cancelled'), 0))::int as points
  from public.reservations
  group by user_id
),
tiered as (
  select u.id as user_id,
    coalesce((select t.discount_pct from public.tiers t where t.min_points <= coalesce(p.points, 0) order by t.min_points desc limit 1), 0) as pct
  from public.users u
  left join pts p on p.user_id = u.id
  where u.role = 'passenger'
),
pax as (
  select array_agg(id order by id) as ids from public.users where role = 'passenger'
),
bookings as (
  select g,
    p.ids[1 + ((g / 2) % array_length(p.ids, 1))] as pid,
    pg_temp.sid('ride-extra-' || g::text) as ride_id
  from generate_series(1, 210) as g cross join pax p
  where g % 2 = 0
)
insert into public.reservations (id, user_id, ride_id, seats_booked, total_price, status, idempotency_key, booked_at, discount_pct)
select
  pg_temp.sid('res-extra-' || b.g::text),
  b.pid, b.ride_id, 1 + (b.g % 2),
  round(rd.price_per_seat * (1 + (b.g % 2)) * (1 - tr.pct / 100.0) + 3, 2),
  'confirmed',
  'seed-res-extra-' || b.g::text,
  now() - ((b.g % 5) || ' days')::interval,
  tr.pct
from bookings b
join public.rides rd on rd.id = b.ride_id
join tiered tr on tr.user_id = b.pid
on conflict (id) do update set total_price = excluded.total_price, discount_pct = excluded.discount_pct;


-- ════════════════════════════════════════════════════════════════════════════
-- §8 Payments — one per reservation (succeeded / refunded), a few flagged
-- ════════════════════════════════════════════════════════════════════════════
-- Fixed demo payments for Mariem (601 mirrors her discounted 40.40 total).
insert into public.payments (id, reservation_id, method, amount, status, gateway_reference, flagged, paid_at, refunded_at, refunded_amount, refund_type) values
  ('9849f27b-380f-4277-88a9-000000000601', '2bb9646b-e2fb-479e-88dd-000000000501', 'flouci', 40.40, 'succeeded', 'PAY-SEED-UPCOMING',   false, now() - interval '2 hours', null,                        null,  null),
  ('9949f40e-2957-498d-8c94-000000000602', '2cb965fe-c247-4551-86d8-000000000502', 'cash',   14.00, 'refunded',  'CASH-SEED-CANCELLED', false, now() - interval '1 day',   now() - interval '20 hours', 11.00, 'partial')
on conflict (id) do update set
  method = excluded.method, amount = excluded.amount, status = excluded.status,
  gateway_reference = excluded.gateway_reference, flagged = excluded.flagged,
  paid_at = excluded.paid_at, refunded_at = excluded.refunded_at,
  refunded_amount = excluded.refunded_amount, refund_type = excluded.refund_type;

-- Every other reservation gets a payment. Cancelled ⇒ refunded (seat cost only,
-- 3 TND fee retained). ~3% of confirmed payments are flagged for the admin queue.
insert into public.payments (id, reservation_id, method, amount, status, gateway_reference, flagged, flagged_reason, platform_fee, driver_fee, refunded_amount, refund_type, paid_at, refunded_at)
select
  pg_temp.sid('pay-' || res.id::text),
  res.id,
  (array['card','cash','wallet','flouci','konnect','mobile_pay']::payment_method[])[1 + (abs(hashtext(res.id::text)) % 6)],
  res.total_price,
  case when res.status = 'cancelled' then 'refunded'::payment_status else 'succeeded'::payment_status end,
  'SEED-' || upper(substr(replace(res.id::text, '-', ''), 1, 12)),
  (abs(hashtext(res.id::text)) % 37 = 0 and res.status = 'confirmed'),
  case when abs(hashtext(res.id::text)) % 37 = 0 and res.status = 'confirmed' then 'Unusual booking velocity — auto-flagged for review' else null end,
  1.000, 2.000,
  case when res.status = 'cancelled' then greatest(res.total_price - 3, 0) else null end,
  case when res.status = 'cancelled' then 'partial' else null end,
  res.booked_at,
  res.cancelled_at
from public.reservations res
where not exists (select 1 from public.payments p where p.reservation_id = res.id)
on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- §9 Deliveries (full lifecycle) + their payments
-- ════════════════════════════════════════════════════════════════════════════
-- One delivery spanning all three ride states so the full lifecycle is present:
-- every in-progress ride (⇒ picked_up), recent completed rides (⇒ delivered),
-- and upcoming rides (⇒ pending / confirmed / cancelled). Tier drives the price.
with dpool as (
      (select r.id as ride_id, r.status::text as rstatus, 1 as grp
         from public.rides r
        where r.status = 'in_progress' and r.accepts_delivery)
  union all
      (select r.id, r.status::text, 2
         from public.rides r
        where r.status = 'completed' and r.accepts_delivery
        order by r.departure_time desc limit 14)
  union all
      (select r.id, r.status::text, 3
         from public.rides r
        where r.status = 'scheduled' and r.accepts_delivery
        order by r.departure_time asc limit 14)
),
dcalc as (
  select ride_id, rstatus,
    row_number() over (order by grp, ride_id) as rn,
    case
      when rstatus = 'completed'   then 'delivered'
      when rstatus = 'in_progress' then 'picked_up'
      when row_number() over (order by grp, ride_id) % 7 = 0 then 'cancelled'
      when row_number() over (order by grp, ride_id) % 3 = 0 then 'confirmed'
      else 'pending'
    end as dstatus
  from dpool
)
insert into public.delivery (id, user_id, ride_id, severity_tier, severity_label, item_description, price, status, booked_at, cancelled_at, driver_notes)
select
  pg_temp.sid('delivery-' || rn::text),
  (array['f06de460-2e24-4067-84aa-000000000101','7770f77c-23bc-480c-886d-000000000111','7870f910-9c85-40ce-8802-000000000112','7970faa0-0e56-4a91-886e-000000000113','7a70fc34-d633-46b7-8081-000000000114','7b70fdc8-b8fd-4b12-8016-000000000115','7c70ff58-9d86-4c02-8887-000000000116','7d7100ec-e6e8-4904-8c0a-000000000117','6e70e950-4768-4b6b-88dc-000000000118']::uuid[])[1 + (rn % 9)],
  ride_id,
  (1 + (rn % 3))::smallint,
  (array['Documents','Small parcel','Large parcel']::text[])[1 + (rn % 3)],
  (array['Sealed envelope of documents','Shoe-box sized package','Large suitcase']::text[])[1 + (rn % 3)],
  (array[10,15,20]::numeric[])[1 + (rn % 3)],
  dstatus,
  now() - ((rn % 20) || ' days')::interval,
  case when dstatus = 'cancelled' then now() - ((rn % 9) || ' days')::interval else null end,
  case when dstatus in ('delivered','picked_up') then 'Handled with care, kept upright.' else null end
from dcalc
on conflict (id) do update set status = excluded.status, driver_notes = excluded.driver_notes;

insert into public.payments (id, delivery_id, method, amount, status, gateway_reference, platform_fee, driver_fee, refunded_amount, refund_type, paid_at, refunded_at)
select
  pg_temp.sid('paydel-' || d.id::text),
  d.id,
  (array['card','cash','flouci','konnect']::payment_method[])[1 + (abs(hashtext(d.id::text)) % 4)],
  d.price,
  case when d.status = 'cancelled' then 'refunded'::payment_status else 'succeeded'::payment_status end,
  'SEEDDEL-' || upper(substr(replace(d.id::text, '-', ''), 1, 10)),
  2.000, 8.000,
  case when d.status = 'cancelled' then d.price else null end,
  case when d.status = 'cancelled' then 'full' else null end,
  d.booked_at,
  d.cancelled_at
from public.delivery d
where not exists (select 1 from public.payments p where p.delivery_id = d.id)
on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- §9b Reviews — ~60% of completed, confirmed reservations (ratings 2–5)
-- ════════════════════════════════════════════════════════════════════════════
insert into public.reviews (id, reservation_id, rating, comment, created_at)
select
  pg_temp.sid('review-' || res.id::text),
  res.id,
  case when abs(hashtext(res.id::text)) % 19 = 0 then 2 else 3 + (abs(hashtext(res.id::text)) % 3) end,
  (array[
    'Great driver, smooth and safe ride.',
    'On time and very friendly.',
    'Comfortable trip, would book again.',
    'Good experience overall, thank you.',
    'Car was clean and the AC worked well.',
    'Trajet agréable, chauffeur ponctuel.',
    'Bonne conduite, je recommande.'
  ]::text[])[1 + (abs(hashtext(res.id::text)) % 7)],
  res.booked_at + interval '1 day'
from public.reservations res
join public.rides r on r.id = res.ride_id
where r.status = 'completed' and res.status = 'confirmed'
  and abs(hashtext(res.id::text)) % 10 < 6
on conflict (reservation_id) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- §10 Notifications · support tickets · chat threads · seat lock · GPS · audit
-- ════════════════════════════════════════════════════════════════════════════
insert into public.notifications (id, user_id, title, body, read, created_at) values
  ('fce36e4f-9017-4ad2-84c8-000000000701', 'f06de460-2e24-4067-84aa-000000000101', 'Welcome to Louagi', 'Search a route to book your first seat.', true, now() - interval '14 months')
on conflict (id) do update set title = excluded.title, body = excluded.body, read = excluded.read;

insert into public.notifications (id, user_id, title, body, read, created_at)
select pg_temp.sid('notif-' || u.id::text || '-' || n.k::text), u.id, n.title, n.body, n.is_read, now() - (n.age_h || ' hours')::interval
from public.users u
cross join (values
  (1, 'Booking confirmed',   'Your seat is booked — have a safe trip!',            true,  5),
  (2, 'Trip reminder',       'Your ride departs tomorrow morning. Be on time.',   false, 20),
  (3, 'Loyalty points added','Points were credited to your balance.',             true,  72),
  (4, 'Weekend promo',       'Members get up to 15% off seat fares this weekend.', false, 120),
  (5, 'Rate your last trip', 'How was your ride? Leave a quick review.',           false, 30)
) n(k, title, body, is_read, age_h)
where u.role = 'passenger'
on conflict (id) do update set title = excluded.title, body = excluded.body, read = excluded.read;

insert into public.notifications (id, user_id, title, body, read, created_at)
select pg_temp.sid('notif-' || u.id::text || '-' || n.k::text), u.id, n.title, n.body, n.is_read, now() - (n.age_h || ' hours')::interval
from public.users u
cross join (values
  (1, 'New booking',       'A passenger booked a seat on your upcoming ride.',         false, 3),
  (2, 'Payout sent',       'Your weekly earnings were transferred to your account.',   true,  48),
  (3, 'Document reminder', 'Please re-upload your driving license before it expires.',  false, 200)
) n(k, title, body, is_read, age_h)
where u.role = 'driver'
on conflict (id) do update set title = excluded.title, body = excluded.body, read = excluded.read;

insert into public.notifications (id, user_id, title, body, read, created_at)
select pg_temp.sid('notif-' || u.id::text || '-' || n.k::text), u.id, n.title, n.body, n.is_read, now() - (n.age_h || ' hours')::interval
from public.users u
cross join (values
  (1, 'Flagged payment',       'A payment was flagged and needs your review.', false, 2),
  (2, 'New driver application', 'A driver is awaiting verification.',           false, 12),
  (3, 'Daily report ready',    'Platform metrics for today are available.',    true,  24)
) n(k, title, body, is_read, age_h)
where u.role = 'admin'
on conflict (id) do update set title = excluded.title, body = excluded.body, read = excluded.read;

insert into public.support_tickets (id, user_id, topic, message, status, created_at) values
  (pg_temp.sid('ticket-1'), '7770f77c-23bc-480c-886d-000000000111', 'payment',  'I think I was charged twice for one booking, can you check?', 'open',     now() - interval '2 days'),
  (pg_temp.sid('ticket-2'), '7970faa0-0e56-4a91-886e-000000000113', 'ride',     'The driver did not show up at the agreed meeting point.',     'resolved', now() - interval '12 days'),
  (pg_temp.sid('ticket-3'), '7c70ff58-9d86-4c02-8887-000000000116', 'account',  'How do I change my registered phone number?',                 'closed',   now() - interval '20 days'),
  (pg_temp.sid('ticket-4'), '7a70fc34-d633-46b7-8081-000000000114', 'delivery', 'My package delivery is delayed — any update?',                'open',     now() - interval '1 day')
on conflict (id) do update set status = excluded.status;

insert into public.messages (id, sender_id, receiver_id, content, is_read, created_at) values
  (pg_temp.sid('msg-1'),  'f06de460-2e24-4067-84aa-000000000101', 'f16de5f0-24f0-4f38-8800-000000000102', 'Hi, is the 8:30 ride to Sfax still on?',            true,  now() - interval '5 hours'),
  (pg_temp.sid('msg-2'),  'f16de5f0-24f0-4f38-8800-000000000102', 'f06de460-2e24-4067-84aa-000000000101', 'Yes, departing on time from Bab Alioua.',           true,  now() - interval '4 hours 50 minutes'),
  (pg_temp.sid('msg-3'),  'f06de460-2e24-4067-84aa-000000000101', 'f16de5f0-24f0-4f38-8800-000000000102', 'Perfect, I booked 2 seats. See you there.',         true,  now() - interval '4 hours 40 minutes'),
  (pg_temp.sid('msg-4'),  'f16de5f0-24f0-4f38-8800-000000000102', 'f06de460-2e24-4067-84aa-000000000101', 'Great, look for the white Peugeot 301.',            true,  now() - interval '4 hours 30 minutes'),
  (pg_temp.sid('msg-5'),  'f06de460-2e24-4067-84aa-000000000101', 'f16de5f0-24f0-4f38-8800-000000000102', 'Will there be room for a small bag?',               true,  now() - interval '4 hours'),
  (pg_temp.sid('msg-6'),  'f16de5f0-24f0-4f38-8800-000000000102', 'f06de460-2e24-4067-84aa-000000000101', 'Of course, no problem.',                            false, now() - interval '3 hours 50 minutes'),
  (pg_temp.sid('msg-7'),  '7870f910-9c85-40ce-8802-000000000112', '7a733acc-60e0-4585-84c8-000000000121', 'Are you the driver for the Sousse–Sfax ride?',      true,  now() - interval '2 days'),
  (pg_temp.sid('msg-8'),  '7a733acc-60e0-4585-84c8-000000000121', '7870f910-9c85-40ce-8802-000000000112', 'Yes! Departure at 10:00.',                          true,  now() - interval '2 days' + interval '5 minutes'),
  (pg_temp.sid('msg-9'),  '7870f910-9c85-40ce-8802-000000000112', '7a733acc-60e0-4585-84c8-000000000121', 'Thanks, can I pay by Flouci?',                      true,  now() - interval '2 days' + interval '10 minutes'),
  (pg_temp.sid('msg-10'), '7a733acc-60e0-4585-84c8-000000000121', '7870f910-9c85-40ce-8802-000000000112', 'Yes, card and Flouci both work.',                   false, now() - interval '2 days' + interval '15 minutes'),
  (pg_temp.sid('msg-11'), '7c70ff58-9d86-4c02-8887-000000000116', '7b733c60-80ac-44bb-8c5e-000000000122', 'Hello, I have a package for delivery to Hammamet.', true,  now() - interval '1 day'),
  (pg_temp.sid('msg-12'), '7b733c60-80ac-44bb-8c5e-000000000122', '7c70ff58-9d86-4c02-8887-000000000116', 'Sure, what size is it?',                            true,  now() - interval '1 day' + interval '8 minutes'),
  (pg_temp.sid('msg-13'), '7c70ff58-9d86-4c02-8887-000000000116', '7b733c60-80ac-44bb-8c5e-000000000122', 'A small parcel, shoe-box size.',                    true,  now() - interval '1 day' + interval '12 minutes'),
  (pg_temp.sid('msg-14'), '7b733c60-80ac-44bb-8c5e-000000000122', '7c70ff58-9d86-4c02-8887-000000000116', 'Got it, I will pick it up before departure.',       false, now() - interval '1 day' + interval '20 minutes'),
  (pg_temp.sid('msg-15'), '7970faa0-0e56-4a91-886e-000000000113', 'f16de5f0-24f0-4f38-8800-000000000102', 'Do you have space tomorrow to Kairouan?',           true,  now() - interval '6 hours'),
  (pg_temp.sid('msg-16'), 'f16de5f0-24f0-4f38-8800-000000000102', '7970faa0-0e56-4a91-886e-000000000113', 'Yes, two seats left. Want me to hold one?',         false, now() - interval '5 hours 40 minutes')
on conflict (id) do update set content = excluded.content, is_read = excluded.is_read;

insert into public.seat_locks (id, ride_id, user_id, seats, idempotency_key, expires_at, created_at) values
  (pg_temp.sid('lock-1'), 'c91febbd-6d3a-4c5e-8697-000000000403', '7970faa0-0e56-4a91-886e-000000000113', 1, 'seed-lock-1', now() + interval '8 minutes', now())
on conflict (ride_id, user_id) do update set expires_at = excluded.expires_at, seats = excluded.seats;

insert into public.driver_locations (driver_id, latitude, longitude, heading, speed, accuracy, updated_at) values
  ('414905e4-e674-4b93-8079-000000000301', 36.7460, 10.2210, 145, 22.5,  8, now() - interval '20 seconds'),
  ('484b4f80-c87d-416a-8849-000000000311', 35.9100, 10.5600, 200, 18.0, 10, now() - interval '15 seconds'),
  ('494b5110-14c6-4d5d-8a1a-000000000312', 36.4200, 10.6100,  95, 25.0,  6, now() - interval '30 seconds')
on conflict (driver_id) do update set
  latitude = excluded.latitude, longitude = excluded.longitude, heading = excluded.heading,
  speed = excluded.speed, accuracy = excluded.accuracy, updated_at = excluded.updated_at;

-- Admin audit trail (append-only; immutable trigger ⇒ insert-or-ignore).
insert into public.audit_log (id, actor_id, actor_role, action, target_entity, target_id, metadata, ip_address, created_at) values
  ('13b08213-bbd4-4c60-88cf-000000000801', 'f26de784-e8c3-497c-80ef-000000000103', 'admin', 'seed.loaded',        'system',  null,                                   '{"source": "supabase/seed.sql"}'::jsonb, 'dev-local', now()),
  (pg_temp.sid('audit-1'), 'f26de784-e8c3-497c-80ef-000000000103', 'admin', 'driver.verified',    'driver',  '484b4f80-c87d-416a-8849-000000000311', '{"plate": "145 TUN 8890"}'::jsonb,     'dev-local', now() - interval '15 months'),
  (pg_temp.sid('audit-2'), 'f26de784-e8c3-497c-80ef-000000000103', 'admin', 'driver.verified',    'driver',  '494b5110-14c6-4d5d-8a1a-000000000312', '{"plate": "210 TUN 3321"}'::jsonb,     'dev-local', now() - interval '18 months'),
  (pg_temp.sid('audit-3'), '81758468-cddf-4057-8093-000000000131', 'admin', 'driver.rejected',    'driver',  '444b4934-4504-40d3-8040-000000000315', '{"reason": "expired license"}'::jsonb, 'dev-local', now() - interval '2 months'),
  (pg_temp.sid('audit-4'), 'f26de784-e8c3-497c-80ef-000000000103', 'admin', 'payment.flagged',    'payment', null,                                   '{"reason": "velocity"}'::jsonb,        'dev-local', now() - interval '3 days'),
  (pg_temp.sid('audit-5'), '81758468-cddf-4057-8093-000000000131', 'admin', 'user.role_changed',  'user',    '81758468-cddf-4057-8093-000000000131', '{"to": "admin"}'::jsonb,               'dev-local', now() - interval '10 months'),
  (pg_temp.sid('audit-6'), 'f26de784-e8c3-497c-80ef-000000000103', 'admin', 'auth.login.success', 'user',    'f26de784-e8c3-497c-80ef-000000000103', '{"mfa": true}'::jsonb,                 'dev-local', now() - interval '10 minutes')
on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- §11 Recompute denormalised counters so everything is internally consistent
-- ════════════════════════════════════════════════════════════════════════════
-- Ride seat availability from confirmed reservations.
update public.rides r
set available_seats = greatest(0, r.total_seats - coalesce(b.booked, 0))
from (
  select ride_id, sum(seats_booked)::int as booked
  from public.reservations where status = 'confirmed' group by ride_id
) b
where b.ride_id = r.id;

-- Delivery slots taken from non-cancelled deliveries (capped at max).
update public.rides r
set delivery_slots_taken = least(r.max_delivery_slots, coalesce(d.cnt, 0))
from (
  select ride_id, count(*)::int as cnt
  from public.delivery where status <> 'cancelled' group by ride_id
) d
where d.ride_id = r.id;

-- Driver completed-trip counts.
update public.drivers d
set trips_completed = coalesce(t.cnt, 0)
from (
  select driver_id, count(*)::int as cnt
  from public.rides where status = 'completed' group by driver_id
) t
where t.driver_id = d.id;

-- Driver ratings from actual reviews (drivers with none keep their seeded value).
update public.drivers d
set rating = rt.avg_rating
from (
  select r.driver_id, round(avg(rev.rating), 2) as avg_rating
  from public.reviews rev
  join public.reservations res on res.id = rev.reservation_id
  join public.rides r on r.id = res.ride_id
  group by r.driver_id
) rt
where rt.driver_id = d.id;
