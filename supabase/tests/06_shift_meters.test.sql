-- Slice 4b: shifts, meter readings (H1, H2), testing (H8), meter-change approval.
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

-- ── Setup (as the database owner) ─────────────────────────────────────────
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner.x@users.pumphisaab.com'),
  ('22222222-2222-2222-2222-222222222222', 'manager.x@users.pumphisaab.com');

create temp table ids on commit drop as
select
  p.id as x,
  gen_random_uuid() as y,
  public.current_business_date(p.id) as today,
  (select id from public.nozzles where pump_id = p.id and label = 'HSD-3') as hsd3,
  (select id from public.nozzles where pump_id = p.id and label = 'MS-3') as ms3,
  gen_random_uuid() as staff_id,
  gen_random_uuid() as y_day,
  gen_random_uuid() as y_shift
from public.pumps p where p.name = 'Shree Lokanath Filling Station';
grant select on ids to authenticated, anon;

insert into public.pump_members (pump_id, user_id, username, full_name, role) values
  ((select x from ids), '11111111-1111-1111-1111-111111111111', 'owner.x', 'Owner X', 'OWNER'),
  ((select x from ids), '22222222-2222-2222-2222-222222222222', 'manager.x', 'Manager X', 'MANAGER');
insert into public.staff (id, pump_id, name) select staff_id, x, 'Ramesh' from ids;
-- The pump has been in the app since the day before yesterday (so yesterday is a real day).
update public.pumps set first_business_date = (select today - 2 from ids) where id = (select x from ids);
-- Pump Y with a day and a shift, to prove it can't be touched.
insert into public.pumps (id, name, rules) select y, 'Pump Y', '{}'::jsonb from ids;
insert into public.business_days (id, pump_id, business_date) select y_day, y, today from ids;
insert into public.shifts (id, pump_id, day_id, shift_code, starts_at, ends_at) select y_shift, y, y_day, 'A', now(), now() + interval '8 hours' from ids;

-- ── Manager of pump X ─────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

create temp table d on commit drop as
select public.open_day((select x from ids), (select today - 1 from ids)) as yday, public.open_day((select x from ids)) as tday;
create temp table s on commit drop as
select
  (select id from public.shifts where day_id = (select yday from d) and shift_code = 'C') as yc,
  (select id from public.shifts where day_id = (select tday from d) and shift_code = 'A') as a,
  (select id from public.shifts where day_id = (select tday from d) and shift_code = 'B') as b,
  (select id from public.shifts where day_id = (select tday from d) and shift_code = 'C') as c;

select is((select array_agg(shift_code order by starts_at) from public.shifts where day_id = (select tday from d)),
  array['A', 'B', 'C'], 'Opening a day makes its shifts A, B, C from the shift timings');
select is((select to_char(starts_at at time zone 'Asia/Kolkata', 'HH24:MI') || '-' || to_char(ends_at at time zone 'Asia/Kolkata', 'HH24:MI')
           || ' +' || (ends_at at time zone 'Asia/Kolkata')::date - (select today from ids)
           from public.shifts where id = (select c from s)),
  '22:00-06:00 +1', 'Shift C runs 10 PM to 6 AM next morning and belongs to the day it started');
select throws_ok($$ insert into public.shifts (pump_id, day_id, shift_code, starts_at, ends_at)
  values ((select x from ids), (select tday from d), 'D', now(), now() + interval '1 hour') $$,
  '42501', null, 'Shifts are made only by the database');

-- The very first reading: nothing earlier to copy, so the opening is typed.
select lives_ok($$ insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, opening, opening_typed, closing)
  values ((select x from ids), (select yday from d), (select yc from s), (select hsd3 from ids), 900, true, 1000) $$,
  'The first reading ever takes a typed opening');
select is((select meter_change_status from public.nozzle_readings where shift_id = (select yc from s)), 'NONE',
  'A typed first opening needs no approval (nothing to compare)');

-- Next shift (next day's Shift A): opening copied from last night's closing.
insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing)
  select x, (select tday from d), (select a from s), hsd3, 1100 from ids;
select is((select opening from public.nozzle_readings where shift_id = (select a from s)), 1000.00,
  'Shift A opening is copied from last night''s Shift C closing');
insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing)
  select x, (select tday from d), (select b from s), hsd3, 1250 from ids;
select is((select opening from public.nozzle_readings where shift_id = (select b from s)), 1100.00,
  'Shift B opening is copied from Shift A closing');
select is((select opening::text || '/' || previous_closing::text || '/' || sale_l::text from public.v_nozzle_readings
           where shift_id = (select b from s) and nozzle_id = (select hsd3 from ids)),
  '1100.00/1100.00/150.00', 'v_nozzle_readings shows opening, previous closing and the sale');

-- Saving the way the app does ("insert or update" on shift + nozzle) works and keeps one row.
select lives_ok($$ insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing)
  values ((select x from ids), (select tday from d), (select b from s), (select hsd3 from ids), 1250)
  on conflict (shift_id, nozzle_id) do update set pump_id = excluded.pump_id, day_id = excluded.day_id,
    shift_id = excluded.shift_id, nozzle_id = excluded.nozzle_id, closing = excluded.closing $$,
  'The app''s save (insert or update) works, safe to repeat');
select is((select count(*) from public.nozzle_readings where shift_id = (select b from s)), 1::bigint, 'Saving twice keeps one reading');
select throws_ok($$ update public.nozzle_readings set closing = 1000 where shift_id = (select b from s) $$,
  '23514', null, 'H1: closing below opening is refused');
select throws_ok($$ insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing)
  values ((select x from ids), (select tday from d), (select c from s), (select ms3 from ids), -5) $$,
  '23514', null, 'H5: a negative meter reading is refused');

-- Meter change on Shift C: typed opening differs from Shift B's closing.
insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, opening, opening_typed, closing)
  select x, (select tday from d), (select c from s), hsd3, 1300, true, 1400 from ids;
select is((select meter_change_status from public.nozzle_readings where shift_id = (select c from s) and nozzle_id = (select hsd3 from ids)),
  'PENDING', 'H2: an opening that isn''t the last closing waits for the owner');
select is((select array_agg(code) from public.day_problems((select tday from d))), array['H2'], 'day_problems() lists the pending meter change');
select throws_ok($$ update public.nozzle_readings set meter_change_status = 'APPROVED' where shift_id = (select c from s) $$,
  '42501', null, 'A manager can''t approve by writing the status');
select throws_ok($$ select public.approve_meter_change((select id from public.nozzle_readings where shift_id = (select c from s) and nozzle_id = (select hsd3 from ids))) $$,
  '42501', null, 'A manager can''t approve a meter change');

-- Testing: more than the nozzle sold is H8; a normal test is fine.
insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres) select x, (select tday from d), (select b from s), hsd3, 200 from ids;
select is((select array_agg(code order by code) from public.day_problems((select tday from d))), array['H2', 'H8'],
  'H8: 200 L tested on a nozzle that sold 150 L');
update public.nozzle_tests set litres = 10 where shift_id = (select b from s);
select is((select meter_litres::text || '/' || test_litres::text from public.v_shift_litres where shift_id = (select b from s) and product = 'HSD'),
  '150.00/10.00', 'v_shift_litres: HSD meter 150 L, testing 10 L');
select throws_ok($$ insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres)
  values ((select x from ids), (select tday from d), (select b from s), (select hsd3 from ids), 0) $$,
  '23514', null, 'A test must be more than 0 L');

-- A fixed closing flows into the next shift's opening.
update public.nozzle_readings set closing = 1150 where shift_id = (select a from s);
select is((select opening from public.nozzle_readings where shift_id = (select b from s)), 1150.00,
  'Fixing Shift A closing moves Shift B''s copied opening with it');

-- Attendants.
select lives_ok($$ insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id)
  values ((select x from ids), (select tday from d), (select a from s), (select staff_id from ids)) $$, 'A manager ticks who worked the shift');
select lives_ok($$ delete from public.shift_attendants where shift_id = (select a from s) $$, 'and can untick them');

-- Another pump.
select throws_ok($$ insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing)
  values ((select y from ids), (select y_day from ids), (select y_shift from ids), (select hsd3 from ids), 10) $$,
  'P0001', null, 'Manager X can''t write a reading into pump Y');
select is((select count(*) from public.shifts where pump_id = (select y from ids)), 0::bigint, 'Manager X can''t see pump Y''s shifts');

-- ── Owner ─────────────────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ select public.approve_meter_change((select id from public.nozzle_readings where shift_id = (select c from s) and nozzle_id = (select hsd3 from ids))) $$,
  'The owner approves the meter change');
select is((select coalesce(array_agg(code), '{}') from public.day_problems((select tday from d))), '{}'::text[],
  'Nothing blocks the day once approved and the test is fixed');

-- Back to the manager: changing the approved opening again needs a new approval.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
update public.nozzle_readings set opening = 1310 where shift_id = (select c from s) and nozzle_id = (select hsd3 from ids);
select is((select meter_change_status from public.nozzle_readings where shift_id = (select c from s) and nozzle_id = (select hsd3 from ids)),
  'PENDING', 'Changing an approved opening again waits for the owner again');

-- A locked day can't be changed.
reset role;
update public.business_days set status = 'LOCKED' where id = (select yday from d);
set local role authenticated;
select throws_ok($$ update public.nozzle_readings set closing = 1001 where shift_id = (select yc from s) $$,
  'P0001', 'This day is locked. Ask the owner to unlock it.', 'Readings on a locked day can''t be changed');
select throws_ok($$ insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres)
  values ((select x from ids), (select yday from d), (select yc from s), (select hsd3 from ids), 5) $$,
  'P0001', 'This day is locked. Ask the owner to unlock it.', 'Testing on a locked day can''t be added');

select * from finish();
rollback;
