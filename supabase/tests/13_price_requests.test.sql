-- Phase 5a Part 1: "Price is different" → owner approves (D119, D120; hard rule 10 as changed).
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- ── Setup (as the database owner) ─────────────────────────────────────────
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner.x@users.pumphisaab.com'),
  ('22222222-2222-2222-2222-222222222222', 'manager.x@users.pumphisaab.com'),
  ('33333333-3333-3333-3333-333333333333', 'manager.y@users.pumphisaab.com');

create temp table ids on commit drop as
select p.id as x, gen_random_uuid() as y, public.current_business_date(p.id) as today, gen_random_uuid() as done_day
from public.pumps p where p.name = 'Shree Lokanath Filling Station';
grant select on ids to authenticated, anon;

insert into public.pumps (id, name, rules) select y, 'Pump Y', '{}'::jsonb from ids;
insert into public.pump_members (pump_id, user_id, username, full_name, role) values
  ((select x from ids), '11111111-1111-1111-1111-111111111111', 'owner.x', 'Owner X', 'OWNER'),
  ((select x from ids), '22222222-2222-2222-2222-222222222222', 'manager.x', 'Manager X', 'MANAGER'),
  ((select y from ids), '33333333-3333-3333-3333-333333333333', 'manager.y', 'Manager Y', 'MANAGER');
-- The owner's dealer margin on the price in force (D64): an approved price carries it over.
update public.fuel_prices set margin_per_l = 2.60 where pump_id = (select x from ids) and product = 'HSD';
insert into public.business_days (id, pump_id, business_date) select done_day, x, today - 1 from ids;
update public.business_days set status = 'SUBMITTED' where id = (select done_day from ids);

-- ── Manager of pump X ─────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

create temp table opened on commit drop as select public.open_day((select x from ids)) as today_id;
select public.confirm_prices((select today_id from opened));
select ok((select price_confirmed from public.v_business_days where id = (select today_id from opened)), 'Setup: today''s price is confirmed');

select lives_ok($$ select public.request_price((select today_id from opened), 'HSD', 102.10) $$,
  'A manager taps "Price is different" and types the diesel price');
select is((select array[status, per_litre::text, starts_on::text] from public.price_requests where day_id = (select today_id from opened)),
  array['WAITING', '102.10', (select today::text from ids)], 'It waits for the owner, starting on that day');
select ok(not (select price_confirmed from public.v_business_days where id = (select today_id from opened)),
  'D120: the day''s price is no longer confirmed (money check and Submit wait)');
select throws_ok($$ select public.confirm_prices((select today_id from opened)) $$,
  'P0001', 'A new price is waiting for the owner''s OK.', 'Confirm is refused while the price waits');
select lives_ok($$ select public.request_price((select today_id from opened), 'HSD', 102.01) $$, 'A second try for the same fuel');
select is((select array_agg(per_litre::text) from public.price_requests where day_id = (select today_id from opened) and status = 'WAITING'),
  array['102.01'], '... replaces the first (one waiting price per day and fuel)');
select is(public.price_for((select x from ids), 'HSD', (select today from ids)), 101.74::numeric, 'The old price is still used until the owner approves');
select throws_ok($$ select public.request_price((select today_id from opened), 'MS', 110.075) $$,
  'P0001', 'Type the price per litre, like 110.07.', 'A price with more than 2 decimals is refused');
select throws_ok($$ select public.request_price((select done_day from ids), 'MS', 111.00) $$,
  'P0001', 'This day is already submitted. Ask the owner to change the price.', 'Not on a day that is already submitted');
select throws_ok($$ select public.answer_price_request((select id from public.price_requests where status = 'WAITING' limit 1), true) $$,
  '42501', 'Only the owner can approve a price.', 'A manager can''t approve a price');
select throws_ok($$ insert into public.price_requests (pump_id, day_id, product, per_litre, starts_on)
  values ((select x from ids), (select today_id from opened), 'MS', 1, (select today from ids)) $$,
  '42501', null, 'Requests can''t be written directly, only through request_price()');
select throws_ok($$ insert into public.fuel_prices (pump_id, product, per_litre, starts_on) values ((select x from ids), 'MS', 120, (select today from ids)) $$,
  '42501', null, 'Hard rule 10: a manager still can''t add a price directly');

-- ── Manager of pump Y can't see pump X's requests ─────────────────────────
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*) from public.price_requests), 0::bigint, 'Another pump''s manager sees no requests');

-- ── Owner of pump X ───────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ select public.answer_price_request((select id from public.price_requests where day_id = (select today_id from opened) and status = 'WAITING'), true) $$,
  'The owner taps Approve');
select is((select array[status, (answered_by is not null)::text, (fuel_price_id is not null)::text] from public.price_requests where day_id = (select today_id from opened)),
  array['APPROVED', 'true', 'true'], 'The request is approved, with who and the new price row');
select is((select array[per_litre, margin_per_l] from public.fuel_prices where pump_id = (select x from ids) and product = 'HSD' and starts_on = (select today from ids)),
  array[102.01, 2.60]::numeric[], 'The price is added from that day, with the margin in force');
select throws_ok($$ select public.answer_price_request((select id from public.price_requests where day_id = (select today_id from opened)), false) $$,
  'P0001', 'This price was already answered.', 'A price can''t be answered twice');

-- Keep old price.
create temp table req on commit drop as select public.request_price((select today_id from opened), 'MS', 111.11) as id;
select is((select status from public.price_requests where id = (select id from req)), 'APPROVED',
  'When the owner taps "Price is different", the price is added at once');
select is(public.price_for((select x from ids), 'MS', (select today from ids)), 111.11::numeric, '... and used for the day');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
create temp table req2 on commit drop as select public.request_price((select today_id from opened), 'MS', 99.99) as id;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ select public.answer_price_request((select id from req2), false) $$, 'The owner taps "Keep old price"');
select is((select status from public.price_requests where id = (select id from req2)), 'KEPT', 'The request is closed as kept');
select is(public.price_for((select x from ids), 'MS', (select today from ids)), 111.11::numeric, '... and the price doesn''t change');

-- Back to the manager: nothing waits now, so the day's price can be confirmed.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok($$ select public.confirm_prices((select today_id from opened)) $$, 'After the owner answers, the manager confirms the price');

select * from finish();
rollback;
