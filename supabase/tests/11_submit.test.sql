-- Slice 4f: closing dip, the 8 sections (H4), v_day_match, v_shift_match, and submit_day():
-- every refusal (locked, yesterday first D3, H6, H4, H2), matched, safe twice, submit again.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email) values
  ('22222222-2222-2222-2222-222222222222', 'manager.x@users.pumphisaab.com'),
  ('33333333-3333-3333-3333-333333333333', 'manager.y@users.pumphisaab.com');

create temp table ids on commit drop as
select
  p.id as x,
  gen_random_uuid() as y,
  public.current_business_date(p.id) as today,
  (select id from public.tanks where pump_id = p.id and label = 'MS-1') as ms_tank,
  (select id from public.tanks where pump_id = p.id and label = 'HSD-1') as hsd_tank,
  (select id from public.nozzles where pump_id = p.id and label = 'HSD-3') as hsd3,
  (select id from public.nozzles where pump_id = p.id and label = 'HSD-4') as hsd4,
  (select id from public.nozzles where pump_id = p.id and label = 'MS-3') as ms3,
  (select id from public.nozzles where pump_id = p.id and label = 'MS-4') as ms4,
  (select id from public.payment_types where pump_id = p.id and name = 'Cash') as cash,
  gen_random_uuid() as staff,
  gen_random_uuid() as yesterday
from public.pumps p where p.name = 'Shree Lokanath Filling Station';
grant select on ids to authenticated, anon;

insert into public.pump_members (pump_id, user_id, username, full_name, role) values
  ((select x from ids), '22222222-2222-2222-2222-222222222222', 'manager.x', 'Manager X', 'MANAGER');
insert into public.pumps (id, name, rules) select y, 'Pump Y', '{}'::jsonb from ids;
insert into public.pump_members (pump_id, user_id, username, full_name, role) values
  ((select y from ids), '33333333-3333-3333-3333-333333333333', 'manager.y', 'Manager Y', 'MANAGER');
insert into public.staff (id, pump_id, name) select staff, x, 'Ramesh' from ids;
-- A made-up dip test day won't match the real chart to 0.5%: widen the fuel limit in this test only.
update public.pumps set rules = jsonb_set(rules, '{stockDifference,flagBeyondPercent}', '"1000"'), first_business_date = (select today - 1 from ids)
  where id = (select x from ids);
insert into public.business_days (id, pump_id, business_date) select yesterday, x, today - 1 from ids;

-- A date before the first day, only browsed (its shifts exist, nothing typed).
insert into public.business_days (id, pump_id, business_date) select gen_random_uuid(), x, today - 5 from ids;
select private.ensure_shifts((select id from public.business_days where pump_id = (select x from ids) and business_date = (select today - 5 from ids)));

set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
create temp table d on commit drop as select public.open_day((select x from ids)) as day;
create temp table s on commit drop as select
  (select id from public.shifts where day_id = (select day from d) and shift_code = 'A') as a,
  (select id from public.shifts where day_id = (select day from d) and shift_code = 'B') as b,
  (select id from public.shifts where day_id = (select day from d) and shift_code = 'C') as c;

select is((select bool_or(has_previous) from public.v_nozzle_readings where day_id = (select day from d) and shift_code = 'A'), false,
  'A day browsed before the first day doesn''t count as "last night" for the first day''s openings');

-- ── Refusals, in the order a manager meets them ───────────────────────────
select throws_ok($$ select public.submit_day((select day from d)) $$, 'P0001',
  'Submit ' || to_char((select today - 1 from ids), 'DD Mon') || ' first. Days are submitted in order.', 'D3: yesterday first');
reset role;
update public.business_days set status = 'SUBMITTED' where id = (select yesterday from ids);
set local role authenticated;

select throws_ok($$ select public.submit_day((select day from d)) $$, 'P0001', 'Confirm today''s price on Today first.', 'H6: price not confirmed');
select public.confirm_prices((select day from d));
select throws_ok($$ select public.submit_day((select day from d)) $$, 'P0001',
  'Finish these first: Opening dip, Tanker, Shift A readings, Shift B readings, Shift C readings, Sales, Expenses, Closing dip.',
  'H4: every section not done is named, in Today''s order');

-- ── Fill the whole day ────────────────────────────────────────────────────
insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm) select x, (select day from d), ms_tank, 'OPENING', 100.0 from ids;
insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm) select x, (select day from d), hsd_tank, 'OPENING', 120.0 from ids;
-- Shift A: HSD 100 L + MS 10 L. B: HSD 50 L. C: nothing sold.
insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, opening, opening_typed, closing) select x, (select day from d), (select a from s), hsd3, 1000, true, 1100 from ids;
insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, opening, opening_typed, closing) select x, (select day from d), (select a from s), hsd4, 2000, true, 2000 from ids;
insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, opening, opening_typed, closing) select x, (select day from d), (select a from s), ms3, 500, true, 510 from ids;
insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, opening, opening_typed, closing) select x, (select day from d), (select a from s), ms4, 700, true, 700 from ids;
insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing)
  select x, (select day from d), sh, n, c from ids,
  lateral (values ((select b from s), hsd3, 1150), ((select b from s), hsd4, 2000), ((select b from s), ms3, 510), ((select b from s), ms4, 700),
                  ((select c from s), hsd3, 1150), ((select c from s), hsd4, 2000), ((select c from s), ms3, 510), ((select c from s), ms4, 700)) v(sh, n, c);
insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id)
  select x, (select day from d), sh, staff from ids, lateral (values ((select a from s)), ((select b from s)), ((select c from s))) v(sh);
-- Money: A should have 100 × 101.74 + 10 × 110.07 = ₹11,274.70; B ₹5,087.00; C ₹0. The drawer is never emptied.
update public.shifts set opening_cash = 0 where id = (select a from s);
insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, coins)
  select x, (select day from d), sh, cash, amt from ids,
  lateral (values ((select a from s), 11274.70), ((select b from s), 16361.70), ((select c from s), 16361.70)) v(sh, amt);
update public.shifts set sales_done_at = now() where day_id = (select day from d);
update public.business_days set no_tanker = true, no_expenses = true where id = (select day from d);

select throws_ok($$ select public.submit_day((select day from d)) $$, 'P0001', 'Finish these first: Closing dip.', 'H4: only the closing dip is left');
insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm) select x, (select day from d), ms_tank, 'CLOSING', 99.9 from ids;
insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm) select x, (select day from d), hsd_tank, 'CLOSING', 119.4 from ids;

select is((select bool_and(done) from public.day_sections((select day from d))), true, 'All 8 sections are done');
select is((select count(*) from public.v_day_match where day_id = (select day from d)), 2::bigint, 'v_day_match: one row per fuel');
select is((select sold_as_per_meters from public.v_day_match where day_id = (select day from d) and product = 'HSD'), 150.00,
  'Sold as per meters: HSD 100 + 50 L');
select is((select round(sold_as_per_tank, 2) = round(opening_dip_l - closing_dip_l, 2) from public.v_day_match where day_id = (select day from d) and product = 'HSD'), true,
  'Sold as per tank = opening − closing (no tanker)');
select is((select array_agg(difference::text order by shift_code) from public.v_shift_match where day_id = (select day from d)),
  array['0.0000', '0.0000', '0.0000'], 'v_shift_match: every shift matches');

-- ── Submit ────────────────────────────────────────────────────────────────
select is((public.submit_day((select day from d)) ->> 'is_matched')::boolean, true, 'Submit: the day is Matched');
select is((select status || ' by ' || (submitted_by = '22222222-2222-2222-2222-222222222222')::text from public.business_days where id = (select day from d)),
  'SUBMITTED by true', 'Status Submitted, by the manager');
create temp table first_submit on commit drop as select submitted_at from public.business_days where id = (select day from d);
select lives_ok($$ select public.submit_day((select day from d)) $$, 'Safe to tap twice');
select is((select submitted_at from public.business_days where id = (select day from d)), (select submitted_at from first_submit), 'The first submit time is kept');

-- A fix after submit: Shift C's cash is ₹361.70 short → Submit again updates the result.
update public.shift_payments set coins = 16000 where shift_id = (select c from s) and payment_type_id = (select cash from ids);
select is((public.submit_day((select day from d)) ->> 'is_matched')::boolean, false, 'Submit again after a change: now not matched');
select is((select is_matched from public.business_days where id = (select day from d)), false, 'is_matched is stored');

-- H2: a new opening typed on Shift B (meter repaired) waits for the owner and blocks submit.
update public.nozzle_readings set opening = 1105, opening_typed = true where shift_id = (select b from s) and nozzle_id = (select hsd3 from ids);
select throws_ok($$ select public.submit_day((select day from d)) $$, 'P0001', null, 'H2: a meter change waiting blocks submit');
reset role;
update public.business_days set status = 'LOCKED' where id = (select day from d);
set local role authenticated;
select throws_ok($$ select public.submit_day((select day from d)) $$, 'P0001', 'This day is locked. Ask the owner to unlock it.', 'A locked day can''t be submitted');
select throws_ok($$ update public.business_days set status = 'DRAFT' where id = (select day from d) $$, '42501', null,
  'Status changes only through the functions');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok($$ select public.submit_day((select day from d)) $$, '42501', 'That day belongs to another pump.', 'Pump Y can''t submit pump X''s day');
select is((select count(*) from public.v_day_match where pump_id = (select x from ids)), 0::bigint, 'and sees none of its fuel checks');

select * from finish();
rollback;
