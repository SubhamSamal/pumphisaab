-- Phase 5a Part 3: "Not settled yet" per payment type per day (D103). Never part of the money check.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- ── Setup (as the database owner) ─────────────────────────────────────────
insert into auth.users (id, email) values
  ('22222222-2222-2222-2222-222222222222', 'manager.x@users.pumphisaab.com'),
  ('33333333-3333-3333-3333-333333333333', 'manager.y@users.pumphisaab.com');

create temp table ids on commit drop as
select p.id as x, gen_random_uuid() as y,
  (select id from public.payment_types where pump_id = p.id and name = 'Paytm') as paytm,
  (select id from public.payment_types where pump_id = p.id and kind = 'CASH' limit 1) as cash
from public.pumps p where p.name = 'Shree Lokanath Filling Station';
grant select on ids to authenticated, anon;

insert into public.pumps (id, name, rules) select y, 'Pump Y', '{}'::jsonb from ids;
insert into public.pump_members (pump_id, user_id, username, full_name, role) values
  ((select x from ids), '22222222-2222-2222-2222-222222222222', 'manager.x', 'Manager X', 'MANAGER'),
  ((select y from ids), '33333333-3333-3333-3333-333333333333', 'manager.y', 'Manager Y', 'MANAGER');

-- ── Manager of pump X ─────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
create temp table d on commit drop as select public.open_day((select x from ids)) as day;

select lives_ok($$ insert into public.settlement_pending (pump_id, day_id, payment_type_id, amount)
  values ((select x from ids), (select day from d), (select paytm from ids), 1265) $$,
  'A manager notes ₹1,265 of today''s Paytm not settled yet');
select is((select amount from public.settlement_pending where day_id = (select day from d)), 1265.00::numeric, 'It is kept for the day and the type');
select throws_ok($$ insert into public.settlement_pending (pump_id, day_id, payment_type_id, amount)
  values ((select x from ids), (select day from d), (select paytm from ids), 10) $$,
  '23505', null, 'One amount per day and type (the app changes it instead)');
select lives_ok($$ update public.settlement_pending set amount = 1300 where day_id = (select day from d) $$, 'It can be changed');
select throws_ok($$ insert into public.settlement_pending (pump_id, day_id, payment_type_id, amount)
  values ((select x from ids), (select day from d), (select cash from ids), 10) $$,
  'P0001', 'Not settled is only for Paytm, cards, XtraPower and the like.', 'Not for cash');
select throws_ok($$ update public.settlement_pending set amount = -1 where day_id = (select day from d) $$,
  '23514', null, 'H5: it can''t be negative');
select is((select count(*)::int from public.v_shift_money where day_id = (select day from d) and received is not null), 0,
  'It is not part of the shift money (nothing was received from it)');

-- ── Manager of pump Y ─────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.settlement_pending), 0, 'Another pump''s manager sees nothing');

select * from finish();
rollback;
