-- =====================================================================
-- B&M HomeKeeper — demo seed: "The Miller Home"
--
-- DEMO DATA AND DEMO LOGINS ONLY. Do not run this against production.
-- The three logins below share a well-known password that is published in
-- the repo; they exist so you can click through the app on your phone.
--
--   admin@bmhomekeeper.test   HomeKeeper!2026   (Garrette Becker, owner)
--   tech@bmhomekeeper.test    HomeKeeper!2026   (Dave Reinhart, technician)
--   member@bmhomekeeper.test  HomeKeeper!2026   (Sarah Miller, homeowner)
--
-- Re-runnable: every insert is keyed on a fixed uuid and upserts.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Auth users
-- ---------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000',
   'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'admin@bmhomekeeper.test',
   extensions.crypt('HomeKeeper!2026', extensions.gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Garrette Becker","role":"admin"}'::jsonb,
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'tech@bmhomekeeper.test',
   extensions.crypt('HomeKeeper!2026', extensions.gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Dave Reinhart","role":"tech"}'::jsonb,
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'a0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'member@bmhomekeeper.test',
   extensions.crypt('HomeKeeper!2026', extensions.gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Sarah Miller","role":"member"}'::jsonb,
   '', '', '', '')
on conflict (id) do update
  set encrypted_password = excluded.encrypted_password,
      email_confirmed_at = excluded.email_confirmed_at,
      raw_user_meta_data = excluded.raw_user_meta_data;

-- Email identities, so password sign-in works.
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
values
  ('a0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   '{"sub":"a0000000-0000-4000-8000-000000000001","email":"admin@bmhomekeeper.test","email_verified":true,"phone_verified":false}'::jsonb,
   'email', now(), now(), now()),
  ('a0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000002',
   '{"sub":"a0000000-0000-4000-8000-000000000002","email":"tech@bmhomekeeper.test","email_verified":true,"phone_verified":false}'::jsonb,
   'email', now(), now(), now()),
  ('a0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000003',
   '{"sub":"a0000000-0000-4000-8000-000000000003","email":"member@bmhomekeeper.test","email_verified":true,"phone_verified":false}'::jsonb,
   'email', now(), now(), now())
on conflict (id) do nothing;

-- Profiles (the trigger creates these; this makes the values explicit).
insert into public.profiles (id, role, full_name, email, phone)
values
  ('a0000000-0000-4000-8000-000000000001', 'admin',  'Garrette Becker', 'admin@bmhomekeeper.test',  '(717) 555-0101'),
  ('a0000000-0000-4000-8000-000000000002', 'tech',   'Dave Reinhart',   'tech@bmhomekeeper.test',   '(717) 555-0102'),
  ('a0000000-0000-4000-8000-000000000003', 'member', 'Sarah Miller',    'member@bmhomekeeper.test', '(717) 555-0103')
on conflict (id) do update
  set role = excluded.role,
      full_name = excluded.full_name,
      email = excluded.email,
      phone = excluded.phone;

-- ---------------------------------------------------------------------
-- 2. The property
-- ---------------------------------------------------------------------
insert into public.properties (
  id, name, address_line1, city, state, postal_code,
  year_built, square_feet, bedrooms, bathrooms, lot_size_acres,
  plan_tier, member_since, notes
)
values (
  'b0000000-0000-4000-8000-000000000001',
  'The Miller Home', '123 Maple Ave', 'Lancaster', 'PA', '17601',
  1998, 2400, 4, 2.5, 0.31,
  'HomeKeeper Premier', '2024-03-01',
  'Two-story colonial, original owners until 2019. Vinyl siding, architectural shingle roof replaced 2016. Municipal water and sewer, natural gas.'
)
on conflict (id) do update
  set name = excluded.name,
      year_built = excluded.year_built,
      square_feet = excluded.square_feet,
      bathrooms = excluded.bathrooms,
      notes = excluded.notes;

-- Homeowners
insert into public.members (id, property_id, profile_id, first_name, last_name, email, phone, is_primary, relationship)
values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000003', 'Sarah', 'Miller', 'member@bmhomekeeper.test', '(717) 555-0103', true, 'Owner'),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   null, 'Tom', 'Miller', 'tom.miller@example.com', '(717) 555-0104', false, 'Spouse')
on conflict (id) do nothing;

-- Assign Dave to the Miller property.
insert into public.property_techs (property_id, profile_id)
values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 3. Rooms
-- ---------------------------------------------------------------------
insert into public.rooms (id, property_id, name, room_type, floor, sort_order, notes) values
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Kitchen',          'Kitchen',   'Main',     10, 'Remodeled 2021 by B&M. Quartz counters, soft-close cabinetry.'),
  ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Primary Bathroom', 'Bathroom',  'Upper',    20, 'Full gut remodel 2022 by B&M. Onyx shower system.'),
  ('d0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'Hall Bathroom',    'Bathroom',  'Upper',    30, 'Original 1998 tub/shower, refreshed fixtures 2023.'),
  ('d0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'Powder Room',      'Bathroom',  'Main',     40, 'Half bath off the front hall.'),
  ('d0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'Primary Bedroom',  'Bedroom',   'Upper',    50, null),
  ('d0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', 'Bedroom 2',        'Bedroom',   'Upper',    60, null),
  ('d0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001', 'Bedroom 3',        'Bedroom',   'Upper',    70, null),
  ('d0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000001', 'Living Room',      'Living',    'Main',     80, null),
  ('d0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000001', 'Dining Room',      'Dining',    'Main',     90, null),
  ('d0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-000000000001', 'Laundry Room',     'Utility',   'Main',    100, 'Off the garage entry.'),
  ('d0000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-000000000001', 'Basement',         'Basement',  'Lower',   110, 'Unfinished, poured concrete. Mechanicals live here.'),
  ('d0000000-0000-4000-8000-00000000000c', 'b0000000-0000-4000-8000-000000000001', 'Garage',           'Garage',    'Main',    120, 'Two-car attached.'),
  ('d0000000-0000-4000-8000-00000000000d', 'b0000000-0000-4000-8000-000000000001', 'Attic',            'Attic',     'Attic',   130, 'Blown-in insulation, pull-down stair access.'),
  ('d0000000-0000-4000-8000-00000000000e', 'b0000000-0000-4000-8000-000000000001', 'Exterior',         'Exterior',  'Exterior',140, 'Siding, roof, gutters, grounds, deck.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 4. Assets — the Home Record (32 items)
-- ---------------------------------------------------------------------
insert into public.assets (
  id, property_id, room_id, category, name, manufacturer, model, serial_number,
  finish, install_date, warranty_expires, expected_life_years, condition,
  last_serviced_at, location_notes, notes
) values
  -- Plumbing fixtures
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   'Plumbing Fixture', 'Kitchen Faucet', 'Delta', 'Trinsic 9159-AR-DST', 'DL-9159-114277',
   'Arctic Stainless', '2021-06-18', '2099-12-31', 15, 'GOOD', '2026-04-14',
   'Kitchen sink, island run', 'Delta lifetime limited warranty on finish and function. Pull-down magnetic docking spray.'),
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
   'Plumbing Fixture', 'Primary Bath Faucet — Left Vanity', 'Delta', 'Trinsic 559LF-SS', 'DL-559-208841',
   'Stainless', '2022-04-02', '2099-12-31', 15, 'GOOD', '2026-04-14',
   'Left basin, double vanity', 'Matched pair with right vanity.'),
  ('e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
   'Plumbing Fixture', 'Primary Bath Faucet — Right Vanity', 'Delta', 'Trinsic 559LF-SS', 'DL-559-208842',
   'Stainless', '2022-04-02', '2099-12-31', 15, 'GOOD', '2026-04-14',
   'Right basin, double vanity', 'Matched pair with left vanity.'),
  ('e0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
   'Plumbing Fixture', 'Shower Valve & Trim', 'Delta', 'Trinsic T17T259-SS TempAssure 17T', 'DL-17T-556120',
   'Stainless', '2022-04-02', '2099-12-31', 20, 'GOOD', '2026-04-14',
   'Primary shower', 'Thermostatic valve with integrated volume control.'),
  ('e0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
   'Shower System', 'Onyx Shower Base & Surround', 'Onyx Collection', 'Custom 60x36 Base + 3-Panel Surround', 'ONX-2022-04117',
   'Bone / Matrix pattern', '2022-04-02', '2037-04-02', 30, 'GOOD', '2026-09-08',
   'Primary bathroom', 'Cast-to-order onyx. 15-year manufacturer warranty. Clean with non-abrasive only — no bleach or scouring pads.'),
  ('e0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
   'Plumbing Fixture', 'Primary Bath Toilet', 'Kohler', 'Cimarron K-31641', 'KH-31641-77120',
   'White', '2022-04-02', '2023-04-02', 25, 'GOOD', null,
   'Primary bathroom', 'Comfort height, 1.28 gpf.'),
  ('e0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003',
   'Plumbing Fixture', 'Hall Bath Tub/Shower Valve', 'Moen', 'Posi-Temp 82910', 'MN-82910-331904',
   'Chrome', '2023-05-11', '2099-12-31', 20, 'GOOD', null,
   'Hall bathroom', 'Trim replaced 2023, original 1998 valve body retained.'),
  ('e0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003',
   'Plumbing Fixture', 'Hall Bath Toilet', 'American Standard', 'Cadet 3 215AA.104', 'AS-215-904471',
   'White', '2019-08-20', null, 25, 'FAIR', null,
   'Hall bathroom', 'Flapper replaced 2025. Running intermittently — see findings.'),
  ('e0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004',
   'Plumbing Fixture', 'Powder Room Toilet', 'Kohler', 'Wellworth K-3987', 'KH-3987-22841',
   'White', '1998-05-01', null, 25, 'FAIR', null,
   'Powder room', 'Original to the house. Nearing end of expected service life.'),
  ('e0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004',
   'Plumbing Fixture', 'Powder Room Faucet', 'Delta', 'Trinsic 559LF-BL', 'DL-559-771203',
   'Matte Black', '2023-05-11', '2099-12-31', 15, 'GOOD', null,
   'Powder room', null),
  -- Water / mechanical
  ('e0000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b',
   'Water Heater', 'Gas Water Heater — 50 gal', 'Bradford White', 'RG250T6N', 'BW-RG250-FE4471928',
   null, '2019-11-07', '2025-11-07', 12, 'FAIR', '2026-09-08',
   'Basement, northeast corner', '50 gallon atmospheric vent, natural gas. Anode rod never replaced — flagged in the Home Plan.'),
  ('e0000000-0000-4000-8000-00000000000c', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b',
   'HVAC', 'Gas Furnace', 'Carrier', 'Infinity 59TN6A080V17--14', 'CR-59TN-4218H09412',
   null, '2014-10-02', '2024-10-02', 20, 'GOOD', '2026-09-08',
   'Basement mechanical area', '80,000 BTU, 96% AFUE two-stage. Filter size 16x25x5.'),
  ('e0000000-0000-4000-8000-00000000000d', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000e',
   'HVAC', 'A/C Condenser — 3 ton', 'Carrier', '24ANB136A003', 'CR-24ANB-3814W22087',
   null, '2014-10-02', '2024-10-02', 15, 'FAIR', '2026-04-14',
   'Exterior, east side pad', 'R-410A. Refrigerant charge verified spring 2026.'),
  ('e0000000-0000-4000-8000-00000000000e', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b',
   'HVAC', 'Whole-House Humidifier', 'Aprilaire', '700M', 'AP-700-1190338',
   null, '2014-10-02', null, 15, 'GOOD', '2026-09-08',
   'Mounted on furnace supply plenum', 'Water panel changed each fall visit.'),
  ('e0000000-0000-4000-8000-00000000000f', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000008',
   'HVAC', 'Smart Thermostat', 'ecobee', 'Smart Thermostat Premium EB-STATE6', 'EB-STATE6-1192840',
   null, '2023-02-14', '2026-02-14', 10, 'GOOD', null,
   'Living room, interior wall', 'Wired with C-wire. Remote sensor in primary bedroom.'),
  ('e0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b',
   'Electrical', 'Main Electrical Panel — 200A', 'Square D', 'QO140M200 Homeline 200A', 'SQ-QO140-9928471',
   null, '1998-05-01', null, 40, 'GOOD', '2026-04-14',
   'Basement, south wall', '200 amp service, 40 space. Six open breaker positions. AFCI added to bedroom circuits 2021.'),
  ('e0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b',
   'Plumbing', 'Sump Pump', 'Zoeller', 'M53 Mighty-Mate 1/3 HP', 'ZL-M53-772019',
   null, '2021-03-22', '2024-03-22', 10, 'GOOD', '2026-04-14',
   'Basement, northwest pit', 'Cast iron 1/3 HP. No battery backup — see Home Plan.'),
  ('e0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b',
   'Plumbing', 'Water Softener', 'Culligan', 'HE Twin 1.5', 'CU-HET-4429183',
   null, '2020-07-15', '2025-07-15', 15, 'GOOD', '2026-09-08',
   'Basement, beside water entry', 'Salt level checked each visit.'),
  ('e0000000-0000-4000-8000-000000000013', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b',
   'Plumbing', 'Main Water Shutoff', null, 'Ball valve, 1 in.', null,
   null, '1998-05-01', null, 40, 'GOOD', null,
   'Basement, north wall where service enters', 'IMPORTANT: this is the valve to close in a plumbing emergency. Turns clockwise.'),
  -- Kitchen appliances
  ('e0000000-0000-4000-8000-000000000014', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   'Appliance', 'Dishwasher', 'Bosch', '800 Series SHPM88Z75N', 'BS-SHPM-FD9812774',
   'Stainless', '2021-06-18', '2023-06-18', 12, 'GOOD', null,
   'Kitchen, left of sink', 'CrystalDry. Third rack.'),
  ('e0000000-0000-4000-8000-000000000015', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   'Appliance', 'Refrigerator', 'GE', 'Profile PVD28BYNFS', 'GE-PVD28-RA912847',
   'Fingerprint Resistant Stainless', '2021-06-18', '2022-06-18', 14, 'GOOD', null,
   'Kitchen, north wall', '27.9 cu ft French door. Water line to icemaker has a shutoff behind the unit.'),
  ('e0000000-0000-4000-8000-000000000016', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   'Appliance', 'Gas Range', 'Bosch', '800 Series HGI8056UC', 'BS-HGI8-FD9814402',
   'Stainless', '2021-06-18', '2022-06-18', 15, 'GOOD', null,
   'Kitchen, island-adjacent', '30 in. slide-in gas, convection.'),
  ('e0000000-0000-4000-8000-000000000017', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   'Appliance', 'Range Hood', 'Broan', 'Glacier BCSD130SS', 'BR-BCSD-8871204',
   'Stainless', '2021-06-18', '2022-06-18', 15, 'GOOD', '2026-09-08',
   'Above range', 'Ducted to exterior through the north wall. 400 CFM.'),
  ('e0000000-0000-4000-8000-000000000018', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   'Appliance', 'Garbage Disposal', 'InSinkErator', 'Evolution Compact 3/4 HP', 'IS-EVC-5529913',
   null, '2021-06-18', '2025-06-18', 12, 'GOOD', null,
   'Under kitchen sink', null),
  ('e0000000-0000-4000-8000-000000000019', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000a',
   'Appliance', 'Clothes Washer', 'LG', 'WM4000HWA', 'LG-WM40-812SN04471',
   'White', '2022-09-30', '2023-09-30', 12, 'GOOD', null,
   'Laundry room', 'Front load. Braided stainless supply hoses installed at the same time.'),
  ('e0000000-0000-4000-8000-00000000001a', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000a',
   'Appliance', 'Clothes Dryer', 'LG', 'DLEX4000W', 'LG-DLEX-812SN04512',
   'White', '2022-09-30', '2023-09-30', 13, 'GOOD', '2026-09-08',
   'Laundry room', 'Electric. Vent run cleaned at each fall visit.'),
  -- Structure / envelope
  ('e0000000-0000-4000-8000-00000000001b', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000e',
   'Roof', 'Architectural Shingle Roof', 'Owens Corning', 'Duration Storm — Estate Gray', null,
   'Estate Gray', '2016-08-15', '2046-08-15', 30, 'GOOD', '2026-09-08',
   'Whole house', 'SureNail technology. Transferable limited lifetime warranty — paperwork in Documents.'),
  ('e0000000-0000-4000-8000-00000000001c', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000e',
   'Exterior', 'Vinyl Siding', 'CertainTeed', 'Monogram D4 — Sandstone Beige', null,
   'Sandstone Beige', '1998-05-01', null, 40, 'GOOD', null,
   'Whole house', null),
  ('e0000000-0000-4000-8000-00000000001d', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000e',
   'Exterior', 'Gutters & Downspouts', null, '5 in. K-style seamless aluminum', null,
   'White', '2016-08-15', null, 25, 'FAIR', '2026-09-08',
   'Whole house perimeter', 'No gutter guards. Heavy maple leaf load in fall — see findings.'),
  ('e0000000-0000-4000-8000-00000000001e', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000e',
   'Windows', 'Double-Hung Windows (18)', 'Andersen', '400 Series Tilt-Wash', null,
   'White', '1998-05-01', null, 30, 'FAIR', null,
   'Whole house', '18 units. Several with failed seals — see findings.'),
  ('e0000000-0000-4000-8000-00000000001f', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000e',
   'Doors', 'Front Entry Door', 'Therma-Tru', 'Smooth-Star S200', null,
   'Hunter Green', '2016-08-15', '2031-08-15', 30, 'GOOD', null,
   'Front entry', 'Fiberglass with half-lite. Weatherstrip replaced 2024.'),
  ('e0000000-0000-4000-8000-000000000020', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000c',
   'Garage', 'Garage Door Opener', 'LiftMaster', '87504-267 Secure View', 'LM-87504-771029384',
   null, '2023-11-04', '2028-11-04', 15, 'GOOD', '2026-09-08',
   'Garage ceiling', 'Belt drive, battery backup, camera. Photo-eye sensors tested each visit.')
on conflict (id) do nothing;

-- Two more to round out the record
insert into public.assets (
  id, property_id, room_id, category, name, manufacturer, model, serial_number,
  install_date, expected_life_years, condition, last_serviced_at, location_notes, notes
) values
  ('e0000000-0000-4000-8000-000000000021', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000c',
   'Garage', 'Sectional Garage Door', 'Clopay', 'Gallery Collection GD2LU', null,
   '2016-08-15', 25, 'GOOD', '2026-09-08', 'Two-car opening', 'Insulated steel, R-9. Springs inspected each fall.'),
  ('e0000000-0000-4000-8000-000000000022', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000e',
   'Exterior', 'Rear Deck', null, 'Pressure-treated pine, 12x16', null,
   '2005-06-01', 20, 'POOR', '2026-09-08', 'Off the dining room slider',
   'Original structure sound; decking and rail weathered. Replacement is the headline Home Plan item.')
on conflict (id) do nothing;

-- Smoke / CO detectors tracked as one asset group
insert into public.assets (
  id, property_id, room_id, category, name, manufacturer, model,
  install_date, expected_life_years, condition, last_serviced_at, location_notes, notes
) values
  ('e0000000-0000-4000-8000-000000000023', 'b0000000-0000-4000-8000-000000000001', null,
   'Life Safety', 'Smoke & CO Detectors (7)', 'Kidde', '21031373 Hardwired w/ Battery Backup',
   '2021-03-15', 10, 'GOOD', '2026-09-08', 'Each bedroom, both hallways, basement stair',
   'Hardwired and interconnected. Batteries changed each fall visit. Replace whole units 2031.'),
  ('e0000000-0000-4000-8000-000000000024', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b',
   'Plumbing', 'Whole-House Water Shutoff Valve — Exterior Sillcocks (3)', 'Woodford', 'Model 17 Frost-Free',
   '1998-05-01', 30, 'GOOD', '2026-09-08', 'Front, rear, and garage side',
   'Frost-free hose bibbs. Must disconnect hoses each fall or they will split.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 5. Trade partners
-- ---------------------------------------------------------------------
insert into public.trade_partners (id, company_name, trade, contact_name, email, phone, license_number, notes) values
  ('f0000000-0000-4000-8000-000000000001', 'Keystone Comfort Heating & Air', 'HVAC', 'Mike Kreider',
   'dispatch@keystonecomfort.example', '(717) 555-0210', 'PA-HVAC-88213', 'Preferred HVAC partner. Same-day for members.'),
  ('f0000000-0000-4000-8000-000000000002', 'Susquehanna Plumbing Co.', 'Plumbing', 'Ray Hoover',
   'office@susqplumbing.example', '(717) 555-0222', 'PA-PLB-44190', 'Water heater and repipe work.'),
  ('f0000000-0000-4000-8000-000000000003', 'Lancaster Electric Works', 'Electrical', 'Janelle Stoltzfus',
   'service@lancelectric.example', '(717) 555-0233', 'PA-ELE-71204', 'Panel work and generator installs.'),
  ('f0000000-0000-4000-8000-000000000004', 'Conestoga Roofing & Exteriors', 'Roofing', 'Bud Martin',
   'estimates@conestogaroof.example', '(717) 555-0244', 'PA-154880', 'Gutter guards, roof repair.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 6. Visits (2 completed)
-- ---------------------------------------------------------------------
insert into public.visits (
  id, property_id, tech_id, visit_type, status, scheduled_for,
  started_at, completed_at, title, summary, member_notes
) values
  ('11110000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002', 'SEASONAL', 'COMPLETED',
   '2026-04-14 09:00:00-04', '2026-04-14 09:04:00-04', '2026-04-14 11:22:00-04',
   'Spring 2026 Seasonal Visit',
   'Full spring walkthrough. A/C started and verified, sump pump tested, exterior sillcocks opened, gutters checked. Two items raised for the Home Plan: deck decking is weathering badly and the hall bath toilet is running. Everything else in good order.',
   'Sarah asked about adding a battery backup to the sump pump before storm season. Quoted verbally, added to plan.'),
  ('11110000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002', 'SEASONAL', 'COMPLETED',
   '2026-09-08 13:00:00-04', '2026-09-08 13:02:00-04', '2026-09-08 15:41:00-04',
   'Fall 2026 Seasonal Visit',
   'Heating season prep. Furnace filter and humidifier water panel replaced, dryer vent cleaned, detector batteries changed, garage door springs and photo-eyes checked, hoses disconnected from sillcocks. Water heater is showing its age — anode rod has never been serviced and there is light corrosion at the top fittings. Recommended replacement planning within 18 months.',
   'Tom mentioned the powder room toilet runs occasionally. Confirmed, logged as MONITOR.')
on conflict (id) do nothing;

-- Checklist items for the spring visit
insert into public.checklist_items (visit_id, category, label, result, notes, sort_order) values
  ('11110000-0000-4000-8000-000000000001', 'HVAC',      'Start and test A/C condenser',                'PASS',      'Cooling 18 deg delta-T. Charge good.', 10),
  ('11110000-0000-4000-8000-000000000001', 'HVAC',      'Replace furnace filter (16x25x5)',            'PASS',      null, 20),
  ('11110000-0000-4000-8000-000000000001', 'Plumbing',  'Test sump pump float and discharge',          'PASS',      'Cycled three times. Discharge clear.', 30),
  ('11110000-0000-4000-8000-000000000001', 'Plumbing',  'Open and test exterior sillcocks',            'PASS',      'All three, no leaks.', 40),
  ('11110000-0000-4000-8000-000000000001', 'Plumbing',  'Check all toilets for running / leaks',       'ATTENTION', 'Hall bath flapper leaking by.', 50),
  ('11110000-0000-4000-8000-000000000001', 'Electrical','Panel inspection — thermal check',            'PASS',      'No hot spots. Six spare positions.', 60),
  ('11110000-0000-4000-8000-000000000001', 'Exterior',  'Gutter and downspout inspection',             'ATTENTION', 'Heavy maple debris, no guards.', 70),
  ('11110000-0000-4000-8000-000000000001', 'Exterior',  'Deck structure and surface inspection',       'FAIL',      'Decking cupped and splitting. Structure sound.', 80),
  ('11110000-0000-4000-8000-000000000001', 'Exterior',  'Roof visual from ground and ladder',          'PASS',      'No lifted shingles. Flashing intact.', 90),
  ('11110000-0000-4000-8000-000000000001', 'Appliance', 'Dishwasher and disposal operation check',     'PASS',      null, 100)
on conflict do nothing;

-- Checklist items for the fall visit
insert into public.checklist_items (visit_id, category, label, result, notes, sort_order) values
  ('11110000-0000-4000-8000-000000000002', 'HVAC',      'Furnace start-up and combustion check',       'PASS',      'Clean ignition, no error codes.', 10),
  ('11110000-0000-4000-8000-000000000002', 'HVAC',      'Replace humidifier water panel',              'PASS',      'Aprilaire 35 panel.', 20),
  ('11110000-0000-4000-8000-000000000002', 'HVAC',      'Replace furnace filter (16x25x5)',            'PASS',      null, 30),
  ('11110000-0000-4000-8000-000000000002', 'Plumbing',  'Water heater inspection',                     'ATTENTION', 'Light corrosion at top fittings. Anode never serviced.', 40),
  ('11110000-0000-4000-8000-000000000002', 'Plumbing',  'Disconnect hoses from sillcocks',             'PASS',      'All three.', 50),
  ('11110000-0000-4000-8000-000000000002', 'Plumbing',  'Water softener salt level',                   'PASS',      'Filled to two-thirds.', 60),
  ('11110000-0000-4000-8000-000000000002', 'Life Safety','Test smoke/CO detectors, change batteries',  'PASS',      'All 7 sounded and interconnected.', 70),
  ('11110000-0000-4000-8000-000000000002', 'Appliance', 'Clean dryer vent run',                        'PASS',      'Moderate lint. Run is 14 ft.', 80),
  ('11110000-0000-4000-8000-000000000002', 'Garage',    'Garage door springs, rollers, photo-eyes',    'PASS',      'Reversed correctly on obstruction.', 90),
  ('11110000-0000-4000-8000-000000000002', 'Exterior',  'Clean gutters for leaf season',               'ATTENTION', 'Cleaned. Guards strongly recommended.', 100)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 7. Findings — 12 across all five statuses
-- ---------------------------------------------------------------------
insert into public.findings (
  id, property_id, visit_id, room_id, asset_id, status, title, description,
  recommendation, priority, estimated_cost_low, estimated_cost_high, created_by, created_at
) values
  -- ACTION (red) x2
  ('22220000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-00000000000b', 'e0000000-0000-4000-8000-00000000000b',
   'ACTION', 'Water heater corrosion at top fittings',
   'Light rust staining visible at the cold inlet and hot outlet nipples. Unit is a 2019 Bradford White RG250T6N, now 7 years old, and the anode rod has never been pulled or replaced. Tank is still holding and there is no active leak.',
   'Plan replacement within 12-18 months rather than waiting for a failure in a finished basement. In the meantime, flush the tank and pull the anode rod to assess. Susquehanna Plumbing quoted a like-for-like swap.',
   'HIGH', 1850.00, 2400.00, 'a0000000-0000-4000-8000-000000000002', '2026-09-08 14:05:00-04'),
  ('22220000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000e', 'e0000000-0000-4000-8000-000000000022',
   'ACTION', 'Deck decking and railing failing',
   'Pressure-treated decking from 2005 is cupped, splitting, and has several soft boards near the stair. Two railing balusters are loose. The framing, posts, and ledger are still sound and properly flashed.',
   'Re-deck over the existing frame with composite and replace the railing system. This is the headline item on the Home Plan for spring 2027.',
   'HIGH', 9500.00, 13500.00, 'a0000000-0000-4000-8000-000000000002', '2026-04-14 10:40:00-04'),
  -- PLAN (amber) x2
  ('22220000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000e', 'e0000000-0000-4000-8000-00000000001d',
   'PLAN', 'No gutter guards — heavy leaf load',
   'Three mature silver maples overhang the rear and east elevations. Gutters filled twice between visits this year. Overflow is already staining the siding below the rear corner.',
   'Install micro-mesh gutter guards on the full perimeter. Conestoga Roofing can do this with the spring visit.',
   'MEDIUM', 1400.00, 2100.00, 'a0000000-0000-4000-8000-000000000002', '2026-04-14 10:15:00-04'),
  ('22220000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b', 'e0000000-0000-4000-8000-000000000011',
   'PLAN', 'Sump pump has no battery backup',
   'Single 1/3 HP Zoeller on a standard outlet. The basement sits below the water table during heavy spring rain and a power outage during a storm would leave the pit unprotected.',
   'Add a battery backup pump with its own float and alarm. Sarah asked about this directly at the spring visit.',
   'MEDIUM', 850.00, 1250.00, 'a0000000-0000-4000-8000-000000000002', '2026-04-14 09:50:00-04'),
  -- MONITOR (blue) x3
  ('22220000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000008',
   'MONITOR', 'Hall bath toilet running intermittently',
   'Flapper is leaking by and the tank refills every few hours. Flapper was already replaced once in 2025, so the issue is likely the flush valve seat rather than the flapper itself.',
   'Replace the flush valve assembly at the next visit. Low cost, no urgency, but it is wasting water.',
   'LOW', 145.00, 260.00, 'a0000000-0000-4000-8000-000000000002', '2026-04-14 10:05:00-04'),
  ('22220000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000009',
   'MONITOR', 'Powder room toilet is original to the house',
   'Kohler Wellworth installed at build in 1998, now 28 years old and past typical service life. Tom reports it runs occasionally. Bowl and tank are intact with no visible cracks or weeping at the base.',
   'No action needed yet. Watch for weeping at the closet flange. Budget a replacement in the next two to three years.',
   'LOW', 450.00, 700.00, 'a0000000-0000-4000-8000-000000000002', '2026-09-08 14:30:00-04'),
  ('22220000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-00000000000e', 'e0000000-0000-4000-8000-00000000001e',
   'MONITOR', 'Failed window seals — 3 of 18 units',
   'Visible fogging between panes in the two dining room units and one bedroom 3 unit. Andersen 400 Series from 1998. The remaining 15 units are clear.',
   'Insulated glass units can be replaced individually without replacing the whole window. Monitor for additional failures and do them as a batch when it reaches five or six.',
   'LOW', 1200.00, 1900.00, 'a0000000-0000-4000-8000-000000000002', '2026-09-08 15:05:00-04'),
  -- GOOD (green) x3
  ('22220000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-00000000000b', 'e0000000-0000-4000-8000-00000000000c',
   'GOOD', 'Furnace operating well for its age',
   'Carrier Infinity two-stage, 12 years old. Clean ignition on both stages, no error history in the control, heat exchanger visually clear, combustion looked correct. Filter and humidifier panel replaced at this visit.',
   'Stay on the twice-yearly service rhythm. Expect another 6-8 years of service life.',
   'LOW', null, null, 'a0000000-0000-4000-8000-000000000002', '2026-09-08 13:35:00-04'),
  ('22220000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-00000000000e', 'e0000000-0000-4000-8000-00000000001b',
   'GOOD', 'Roof in excellent condition',
   'Owens Corning Duration Storm from 2016, 10 years into a 30-year expectation. No lifted or missing shingles, granule loss normal for age, step and valley flashing intact, boots and vent collars sound.',
   'Nothing needed. Re-inspect each fall.',
   'LOW', null, null, 'a0000000-0000-4000-8000-000000000002', '2026-09-08 14:50:00-04'),
  ('22220000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000005',
   'GOOD', 'Onyx shower system performing as new',
   'Four years in. No crazing, staining, or seam separation. Caulk joint at the base is intact and flexible. Delta TempAssure valve holding temperature correctly.',
   'Keep using non-abrasive cleaner only. No bleach, no scouring pads — that is what voids the finish warranty.',
   'LOW', null, null, 'a0000000-0000-4000-8000-000000000002', '2026-09-08 14:20:00-04'),
  -- IMPROVEMENT (purple) x2
  ('22220000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-00000000000d', null,
   'IMPROVEMENT', 'Attic insulation could be topped up',
   'Blown-in cellulose measures roughly R-30 across the attic floor, which met code in 1998. Current recommendation for this climate zone is R-49 to R-60. Several spots near the eaves are thin where the baffles stop.',
   'Adding 6-8 inches would cut winter heating cost noticeably and is inexpensive while the attic is otherwise empty. Good candidate to pair with the spring visit.',
   'LOW', 1900.00, 2800.00, 'a0000000-0000-4000-8000-000000000002', '2026-09-08 15:20:00-04'),
  ('22220000-0000-4000-8000-00000000000c', 'b0000000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000b', 'e0000000-0000-4000-8000-000000000010',
   'IMPROVEMENT', 'Panel has capacity for a generator interlock',
   'Square D 200A panel has six open positions and the service is sized with room to spare. A manual transfer interlock kit plus an inlet would let the Millers run the furnace, sump, fridge, and lights off a portable generator.',
   'Worth considering given the sump pump exposure during storm outages. Lancaster Electric Works quoted informally.',
   'LOW', 1600.00, 2400.00, 'a0000000-0000-4000-8000-000000000002', '2026-04-14 11:00:00-04')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 8. The Home Plan
-- ---------------------------------------------------------------------
insert into public.plan_items (
  id, property_id, finding_id, title, description, category,
  target_year, target_season, priority, status,
  estimated_cost_low, estimated_cost_high, sort_order
) values
  ('33330000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', '22220000-0000-4000-8000-000000000004',
   'Add sump pump battery backup', 'Battery backup pump with independent float and high-water alarm. Protects the basement during storm outages.',
   'Plumbing', 2026, 'Fall', 'HIGH', 'APPROVED', 850.00, 1250.00, 10),
  ('33330000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', '22220000-0000-4000-8000-000000000003',
   'Install gutter guards, full perimeter', 'Micro-mesh guards to stop the twice-a-year cleanout and the overflow staining on the rear elevation.',
   'Exterior', 2027, 'Spring', 'MEDIUM', 'PROPOSED', 1400.00, 2100.00, 20),
  ('33330000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', '22220000-0000-4000-8000-000000000002',
   'Re-deck and re-rail rear deck', 'Composite decking and new railing over the existing frame. Structure, posts, and ledger stay.',
   'Exterior', 2027, 'Spring', 'HIGH', 'PROPOSED', 9500.00, 13500.00, 30),
  ('33330000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', '22220000-0000-4000-8000-000000000001',
   'Replace water heater', 'Like-for-like 50 gal Bradford White before the current unit fails in a finished basement.',
   'Plumbing', 2027, 'Fall', 'HIGH', 'PROPOSED', 1850.00, 2400.00, 40),
  ('33330000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', '22220000-0000-4000-8000-00000000000b',
   'Top up attic insulation to R-49', 'Add 6-8 inches of blown-in cellulose and correct the thin spots at the eaves.',
   'Energy', 2027, 'Fall', 'MEDIUM', 'PROPOSED', 1900.00, 2800.00, 50),
  ('33330000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', '22220000-0000-4000-8000-00000000000c',
   'Generator interlock and inlet', 'Manual transfer interlock on the Square D panel plus exterior inlet for a portable generator.',
   'Electrical', 2028, 'Spring', 'LOW', 'PROPOSED', 1600.00, 2400.00, 60),
  ('33330000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001', '22220000-0000-4000-8000-000000000006',
   'Replace powder room toilet', 'Original 1998 Kohler Wellworth. Replace before it starts weeping at the flange.',
   'Plumbing', 2028, 'Spring', 'LOW', 'PROPOSED', 450.00, 700.00, 70)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 9. Service requests (2, at different stages)
-- ---------------------------------------------------------------------
insert into public.service_requests (
  id, property_id, member_id, created_by, trade_partner_id, assigned_tech_id,
  stage, title, description, priority, estimate_amount,
  approved_at, scheduled_for, created_at
) values
  ('44440000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003',
   'f0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002',
   'SCHEDULED', 'Sump pump battery backup install',
   'Approved off the spring visit recommendation. Susquehanna Plumbing to supply and install a battery backup pump with high-water alarm.',
   'HIGH', 1095.00,
   '2026-09-12 10:15:00-04', '2026-10-02 08:00:00-04', '2026-09-09 08:12:00-04'),
  ('44440000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003',
   null, null,
   'TRIAGE', 'Kitchen disposal humming but not spinning',
   'Submitted by Sarah through the member portal: "The disposal under the kitchen sink makes a humming noise when I flip the switch but nothing turns. It has not worked since Thursday."',
   'MEDIUM', null,
   null, null, '2026-09-18 19:44:00-04')
on conflict (id) do nothing;

-- Stage history for both requests
insert into public.service_request_events (service_request_id, from_stage, to_stage, note, actor_id, created_at) values
  ('44440000-0000-4000-8000-000000000001', null, 'NEW', 'Member approved the spring visit recommendation.', 'a0000000-0000-4000-8000-000000000003', '2026-09-09 08:12:00-04'),
  ('44440000-0000-4000-8000-000000000001', 'NEW', 'TRIAGE', 'Confirmed scope against the spring finding.', 'a0000000-0000-4000-8000-000000000001', '2026-09-09 09:30:00-04'),
  ('44440000-0000-4000-8000-000000000001', 'TRIAGE', 'DISPATCHED', 'Sent to Susquehanna Plumbing.', 'a0000000-0000-4000-8000-000000000001', '2026-09-09 09:35:00-04'),
  ('44440000-0000-4000-8000-000000000001', 'DISPATCHED', 'ACCEPTED', 'Ray confirmed availability.', 'a0000000-0000-4000-8000-000000000001', '2026-09-10 07:50:00-04'),
  ('44440000-0000-4000-8000-000000000001', 'ACCEPTED', 'ESTIMATING', 'Site photos sent for quote.', 'a0000000-0000-4000-8000-000000000002', '2026-09-10 11:20:00-04'),
  ('44440000-0000-4000-8000-000000000001', 'ESTIMATING', 'AWAITING_APPROVAL', 'Quote of $1,095 sent to member.', 'a0000000-0000-4000-8000-000000000001', '2026-09-11 16:05:00-04'),
  ('44440000-0000-4000-8000-000000000001', 'AWAITING_APPROVAL', 'APPROVED', 'Sarah approved by text.', 'a0000000-0000-4000-8000-000000000001', '2026-09-12 10:15:00-04'),
  ('44440000-0000-4000-8000-000000000001', 'APPROVED', 'SCHEDULED', 'Booked for Oct 2, 8am. Dave to meet the crew.', 'a0000000-0000-4000-8000-000000000001', '2026-09-12 10:22:00-04'),
  ('44440000-0000-4000-8000-000000000002', null, 'NEW', 'Submitted through the member portal.', 'a0000000-0000-4000-8000-000000000003', '2026-09-18 19:44:00-04'),
  ('44440000-0000-4000-8000-000000000002', 'NEW', 'TRIAGE', 'Likely a jammed impeller. Dave to check on the next visit or sooner if needed.', 'a0000000-0000-4000-8000-000000000001', '2026-09-19 08:05:00-04')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 10. Documents and reports
-- ---------------------------------------------------------------------
insert into public.documents (id, property_id, asset_id, title, doc_type, storage_path, mime_type, uploaded_by) values
  ('55550000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-00000000001b',
   'Owens Corning roof warranty certificate', 'WARRANTY',
   'b0000000-0000-4000-8000-000000000001/demo/roof-warranty.pdf', 'application/pdf', 'a0000000-0000-4000-8000-000000000001'),
  ('55550000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000005',
   'Onyx Collection care and warranty guide', 'WARRANTY',
   'b0000000-0000-4000-8000-000000000001/demo/onyx-care-guide.pdf', 'application/pdf', 'a0000000-0000-4000-8000-000000000001'),
  ('55550000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-00000000000c',
   'Carrier Infinity furnace owner manual', 'MANUAL',
   'b0000000-0000-4000-8000-000000000001/demo/carrier-59tn6a-manual.pdf', 'application/pdf', 'a0000000-0000-4000-8000-000000000001'),
  ('55550000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', null,
   '2022 primary bath remodel — final invoice', 'INVOICE',
   'b0000000-0000-4000-8000-000000000001/demo/2022-bath-remodel-invoice.pdf', 'application/pdf', 'a0000000-0000-4000-8000-000000000001'),
  ('55550000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', null,
   'Township permit — 2021 kitchen remodel', 'PERMIT',
   'b0000000-0000-4000-8000-000000000001/demo/2021-kitchen-permit.pdf', 'application/pdf', 'a0000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

insert into public.reports (id, property_id, visit_id, title, report_type, period_start, period_end, storage_path, generated_by, generated_at) values
  ('66660000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', '11110000-0000-4000-8000-000000000001',
   'Spring 2026 Visit Summary', 'VISIT_SUMMARY', '2026-04-14', '2026-04-14',
   'b0000000-0000-4000-8000-000000000001/demo/spring-2026-visit.pdf', 'a0000000-0000-4000-8000-000000000001', '2026-04-14 16:00:00-04'),
  ('66660000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', '11110000-0000-4000-8000-000000000002',
   'Fall 2026 Visit Summary', 'VISIT_SUMMARY', '2026-09-08', '2026-09-08',
   'b0000000-0000-4000-8000-000000000001/demo/fall-2026-visit.pdf', 'a0000000-0000-4000-8000-000000000001', '2026-09-08 18:30:00-04')
on conflict (id) do nothing;
