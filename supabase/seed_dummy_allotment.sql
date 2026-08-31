-- DEV/TEST SEED — NOT a migration, do not run in production.
-- Paste into the Supabase SQL Editor and run once. Creates 3 dummy users,
-- a closed test IPO, two pools with clubbed applications (mixed allotment
-- statuses), and adds your own account (by email below) as a member of
-- both pools so the Allotments page and clubbing UI have something to
-- show/test. Idempotent — safe to re-run.
--
-- To remove everything this script creates:
--   delete from auth.users where email like '%@dummy.ipopool.test';
--   delete from public.ipos where name = 'Dummy Test IPO';
--   (cascades clean up profiles, pan_cards, pool_members, pool_applications,
--   pool_application_members, and the pools themselves via ipo_id fk... pools
--   don't cascade from ipos, so also run:)
--   delete from public.pools where invite_code in ('dummy001', 'dummy002');

-- Change this to your real signed-in account's email so you can see the
-- dummy pools/applications from your own login.
do $$
declare
  my_email text := 'vedantkparekh@gmail.com';
begin
  perform 1 from public.profiles where email = my_email;
  if not found then
    raise exception 'No profile found for %, update my_email in this script.', my_email;
  end if;
end $$;

create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- 1. Three dummy users (trigger auto-creates their profiles)
-- ============================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'asha@dummy.ipopool.test', extensions.crypt('dummy-password-123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Asha (dummy)"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'rahul@dummy.ipopool.test', extensions.crypt('dummy-password-123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Rahul (dummy)"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated',
   'meera@dummy.ipopool.test', extensions.crypt('dummy-password-123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Meera (dummy)"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- ============================================================
-- 2. PAN cards for each dummy user
-- ============================================================
insert into public.pan_cards (id, owner_id, pan_number, label) values
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'AAAAA1111A', 'Asha primary'),
  ('a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'BBBBB2222B', 'Rahul primary'),
  ('a3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'CCCCC3333C', 'Meera primary')
on conflict (id) do nothing;

-- ============================================================
-- 3. A closed IPO (shows up in the Allotments picker)
-- ============================================================
insert into public.ipos (id, name, type, open_date, close_date, listing_date, price_band_min, price_band_max, lot_size, status, source)
values (
  '99999999-9999-9999-9999-999999999999', 'Dummy Test IPO', 'mainboard',
  '2026-08-01', '2026-08-03', '2026-08-10', 100, 110, 100, 'closed', 'seed'
)
on conflict (id) do update set status = 'closed';

-- ============================================================
-- 4. Two pools for that IPO (retail + shni), each with all 3 dummy
--    users plus your account as members
-- ============================================================
insert into public.pools (id, name, owner_id, invite_code, ipo_id, category) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Dummy Test IPO_retail_seed',
   '11111111-1111-1111-1111-111111111111', 'dummy001', '99999999-9999-9999-9999-999999999999', 'retail'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Dummy Test IPO_shni_seed',
   '22222222-2222-2222-2222-222222222222', 'dummy002', '99999999-9999-9999-9999-999999999999', 'shni')
on conflict (id) do nothing;

insert into public.pool_members (pool_id, profile_id)
select p.pool_id, p.profile_id from (values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111111'::uuid),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '22222222-2222-2222-2222-222222222222'::uuid),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '33333333-3333-3333-3333-333333333333'::uuid),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '11111111-1111-1111-1111-111111111111'::uuid),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '22222222-2222-2222-2222-222222222222'::uuid),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '33333333-3333-3333-3333-333333333333'::uuid)
) as p(pool_id, profile_id)
on conflict (pool_id, profile_id) do nothing;

-- add your own account to both pools too, so you can see/test them
insert into public.pool_members (pool_id, profile_id)
select pool_id, pr.id
from (values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid), ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)) as pools(pool_id)
cross join (select id from public.profiles where email = 'vedantkparekh@gmail.com') as pr
on conflict (pool_id, profile_id) do nothing;

-- ============================================================
-- 5. Applications with mixed allotment statuses + clubbing
-- ============================================================
insert into public.pool_applications (id, pool_id, pan_card_id, status, allotment_status, created_by) values
  ('e1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'a1111111-1111-1111-1111-111111111111', 'applied', 'alloted', '11111111-1111-1111-1111-111111111111'),
  ('e2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'a3333333-3333-3333-3333-333333333333', 'applied', 'not_alloted', '33333333-3333-3333-3333-333333333333'),
  ('e3333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'a2222222-2222-2222-2222-222222222222', 'applied', 'pending', '22222222-2222-2222-2222-222222222222')
on conflict (id) do nothing;

-- Rahul clubs onto Asha's alloted application; Asha and Meera both club
-- onto Rahul's pending application (3-way clubbing, for UI testing)
insert into public.pool_application_members (application_id, profile_id) values
  ('e1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('e3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111'),
  ('e3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333')
on conflict do nothing;
