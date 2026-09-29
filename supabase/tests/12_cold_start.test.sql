-- Cold start (owner, 29 Sep): meter readings can always be set up, even when the day before has
-- no readings. First day in the app, a missing previous closing, a closing typed in later,
-- and the owner fixing a real mismatch.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner.x@users.pumphisaab.com'),
  ('22222222-2222-2222-2222-222222222222', 'manager.x@users.pumphisaab.com');
create temp table ids on commit drop as
select p.id as x, public.current_business_date(p.id) as today,
  (select id from public.nozzles where pump_id = p.id and label = 'HSD-3') as hsd3
from public.pumps p where p.name = 'Shree Lokanath Filling Station';
grant select on ids to authenticated;
insert into public.pump_members (pump_id, user_id, username, full_name, role) values
  ((select x from ids), '11111111-1111-1111-1111-111111111111', 'owner.x', 'Owner X', 'OWNER'),
  ((select x from ids), '22222222-2222-2222-2222-222222222222', 'manager.x', 'Manager X', 'MANAGER');
-- The pilot starts 3 days ago (like 15 Sep for the real pump): past days are typed in later.
update public.pumps set first_business_date = (select today - 3 from ids) where id = (select x from ids);

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
create temp table d on commit drop as select
  public.open_day((select x from ids), (select today - 3 from ids)) as first_day,
  public.open_day((select x from ids), (select today - 2 from ids)) as day2,
  public.open_day((select x from ids), (select today - 1 from ids)) as day3;
create temp table s on commit drop as select
  (select id from public.shifts where day_id = (select first_day from d) and shift_code = 'A') as first_a,
  (select id from public.shifts where day_id = (select first_day from d) and shift_code = 'C') as first_c,
  (select id from public.shifts where day_id = (select day2 from d) and shift_code = 'A') as day2_a,
  (select id from public.shifts where day_id = (select day3 from d) and shift_code = 'A') as day3_a;

-- 1. The very first day: nothing before it, the opening is typed, nothing to approve.
select is((select has_previous from public.v_nozzle_readings where shift_id = (select first_a from s) and nozzle_id = (select hsd3 from ids)), false,
  'First day in the app: no "last night" to copy from');
insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, opening, opening_typed, closing)
  select x, (select first_day from d), (select first_a from s), hsd3, 567503.44, true, 570104.08 from ids;
select is((select opening::text || ' ' || meter_change_status from public.nozzle_readings where shift_id = (select first_a from s) and nozzle_id = (select hsd3 from ids)),
  '567503.44 NONE', 'First day: the typed opening is kept, no approval needed');

-- 2. The day before exists but its readings are missing (C never typed): the manager types the opening.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok($$ insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, opening, opening_typed, closing)
  select x, (select day2 from d), (select day2_a from s), hsd3, 571000, true, 571500 from ids $$,
  'Previous day has no closing: a manager can still type the opening');
select is((select meter_change_status from public.nozzle_readings where shift_id = (select day2_a from s) and nozzle_id = (select hsd3 from ids)), 'NONE',
  'and it needs no approval (nothing to compare it with)');

-- 3. The missing closing is typed in later and agrees: the opening simply follows it.
insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing)
  select x, (select day2 from d), (select id from public.shifts where day_id = (select day2 from d) and shift_code = 'C'), hsd3, 572000 from ids;
insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, opening, opening_typed, closing)
  select x, (select day3 from d), (select day3_a from s), hsd3, 572000, true, 572400 from ids;
select is((select meter_change_status || ' ' || opening_typed::text from public.nozzle_readings where shift_id = (select day3_a from s) and nozzle_id = (select hsd3 from ids)),
  'NONE false', 'A typed opening equal to the last closing is just a normal copied opening');

-- 4. It disagrees (real meter change or typo): waits for the owner, who approves in one step.
update public.nozzle_readings set opening = 572100, opening_typed = true where shift_id = (select day3_a from s) and nozzle_id = (select hsd3 from ids);
select is((select meter_change_status from public.nozzle_readings where shift_id = (select day3_a from s) and nozzle_id = (select hsd3 from ids)), 'PENDING',
  'An opening different from the last closing waits for the owner (H2)');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ select public.approve_meter_change((select id from public.nozzle_readings where shift_id = (select day3_a from s) and nozzle_id = (select hsd3 from ids))) $$,
  'The owner approves it');
select is((select meter_change_status from public.nozzle_readings where shift_id = (select day3_a from s) and nozzle_id = (select hsd3 from ids)), 'APPROVED',
  'and the reading is approved');

select * from finish();
rollback;
