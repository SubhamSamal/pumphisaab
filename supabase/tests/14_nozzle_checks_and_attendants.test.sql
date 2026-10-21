-- Phase 5a Part 2: "The 5 L measure got" (D110, S10) and who was on which nozzle (D115, D121).
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- ── Setup (as the database owner) ─────────────────────────────────────────
insert into auth.users (id, email) values
  ('22222222-2222-2222-2222-222222222222', 'manager.x@users.pumphisaab.com'),
  ('33333333-3333-3333-3333-333333333333', 'manager.y@users.pumphisaab.com');

create temp table ids on commit drop as
select
  p.id as x,
  gen_random_uuid() as y,
  public.current_business_date(p.id) as today,
  (select id from public.nozzles where pump_id = p.id and label = 'HSD-3') as hsd3,
  (select id from public.nozzles where pump_id = p.id and label = 'MS-3') as ms3,
  (select id from public.nozzles where pump_id = p.id and label = 'MS-4') as ms4,
  gen_random_uuid() as ramesh,
  gen_random_uuid() as suresh,
  gen_random_uuid() as other_pump_staff
from public.pumps p where p.name = 'Shree Lokanath Filling Station';
grant select on ids to authenticated, anon;

insert into public.pumps (id, name, rules) select y, 'Pump Y', '{}'::jsonb from ids;
insert into public.pump_members (pump_id, user_id, username, full_name, role) values
  ((select x from ids), '22222222-2222-2222-2222-222222222222', 'manager.x', 'Manager X', 'MANAGER'),
  ((select y from ids), '33333333-3333-3333-3333-333333333333', 'manager.y', 'Manager Y', 'MANAGER');
insert into public.staff (id, pump_id, name) select ramesh, x, 'Ramesh' from ids;
insert into public.staff (id, pump_id, name) select suresh, x, 'Suresh' from ids;
insert into public.staff (id, pump_id, name) select other_pump_staff, y, 'Someone at Y' from ids;

select is((select rules -> 'testing' ->> 'measureFlagBeyondPercent' from public.pumps where id = (select x from ids)), '0.5',
  'The pump''s rules get the measure limit (0.5%, IOCL ±25 mL per 5 L)');

-- ── Manager of pump X ─────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

create temp table d on commit drop as select public.open_day((select x from ids)) as day;
create temp table s on commit drop as
select (select id from public.shifts where day_id = (select day from d) and shift_code = 'A') as a,
       (select id from public.shifts where day_id = (select day from d) and shift_code = 'B') as b;

-- ── "The 5 L measure got" ──────────────────────────────────────────────────
insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres, measured_l) values
  ((select x from ids), (select day from d), (select a from s), (select ms3 from ids), 5, 5.25),   -- +0.25 L = +5%: S10
  ((select x from ids), (select day from d), (select a from s), (select hsd3 from ids), 5, 4.975), -- rounds to 4.98 (2 decimals)
  ((select x from ids), (select day from d), (select a from s), (select ms4 from ids), 5, 5.02);   -- +0.02 L = +0.4%: OK
insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres) values
  ((select x from ids), (select day from d), (select b from s), (select ms3 from ids), 5);          -- no measure: not a check

select is((select count(*)::int from public.v_nozzle_checks where day_id = (select day from d)), 3,
  'Only tests with a measure are nozzle checks (an empty measure changes nothing)');
select is((select array[error_l, round(error_pct, 2)] from public.v_nozzle_checks where nozzle_id = (select ms3 from ids)),
  array[0.25, 5.00]::numeric[], 'MS-3: the measure got 5.25 L for 5 L on the meter: +0.25 L, +5.00%');
select ok((select s10_flag from public.v_nozzle_checks where nozzle_id = (select ms3 from ids)), 'S10: +5% is beyond the 0.5% limit');
select is((select array[measured_l, error_l] from public.v_nozzle_checks where nozzle_id = (select hsd3 from ids)),
  array[4.98, -0.02]::numeric[], 'HSD-3: 4.975 L is kept as 4.98 L (2 decimals): −0.02 L');
select ok(not (select s10_flag from public.v_nozzle_checks where nozzle_id = (select hsd3 from ids)), '−0.40% is within the limit');
select ok(not (select s10_flag from public.v_nozzle_checks where nozzle_id = (select ms4 from ids)), '+0.40% is within the limit');
select throws_ok($$ insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres, measured_l)
  values ((select x from ids), (select day from d), (select a from s), (select ms3 from ids), 5, -1) $$,
  '23514', null, 'H5: a negative measure is refused');

-- ── Who was on which nozzle ────────────────────────────────────────────────
select throws_ok($$ insert into public.nozzle_attendants (pump_id, day_id, shift_id, nozzle_id, staff_id)
  values ((select x from ids), (select day from d), (select a from s), (select ms3 from ids), (select ramesh from ids)) $$,
  'P0001', 'Tick this person on the shift first.', 'A person must be ticked on the shift before going on a nozzle');

insert into public.shift_attendants (pump_id, day_id, shift_id, staff_id) values
  ((select x from ids), (select day from d), (select a from s), (select ramesh from ids)),
  ((select x from ids), (select day from d), (select a from s), (select suresh from ids));
select lives_ok($$ insert into public.nozzle_attendants (pump_id, day_id, shift_id, nozzle_id, staff_id) values
  ((select x from ids), (select day from d), (select a from s), (select ms3 from ids), (select ramesh from ids)),
  ((select x from ids), (select day from d), (select a from s), (select hsd3 from ids), (select suresh from ids)) $$,
  'A manager puts Ramesh on MS-3 and Suresh on HSD-3');
select lives_ok($$ insert into public.nozzle_attendants (pump_id, day_id, shift_id, nozzle_id, staff_id)
  values ((select x from ids), (select day from d), (select a from s), (select ms3 from ids), (select suresh from ids)) $$,
  'D121: two people can share one nozzle in a shift (built to grow)');
select throws_ok($$ insert into public.nozzle_attendants (pump_id, day_id, shift_id, nozzle_id, staff_id)
  values ((select x from ids), (select day from d), (select a from s), (select ms3 from ids), (select ramesh from ids)) $$,
  '23505', null, 'The same person can''t be put on the same nozzle twice');
select throws_ok($$ insert into public.nozzle_attendants (pump_id, day_id, shift_id, nozzle_id, staff_id)
  values ((select x from ids), (select day from d), (select a from s), (select ms4 from ids), (select other_pump_staff from ids)) $$,
  'P0001', null, 'Someone from another pump can''t be put on a nozzle');

delete from public.shift_attendants where shift_id = (select a from s) and staff_id = (select suresh from ids);
select is((select count(*)::int from public.nozzle_attendants where shift_id = (select a from s) and staff_id = (select suresh from ids)), 0,
  'Unticking Suresh from the shift takes him off its nozzles too');
select is((select count(*)::int from public.nozzle_attendants where shift_id = (select a from s)), 1, '... and Ramesh stays on MS-3');

-- ── Manager of pump Y ─────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.nozzle_attendants) + (select count(*)::int from public.v_nozzle_checks), 0,
  'Another pump''s manager sees no nozzle people and no nozzle checks');

select * from finish();
rollback;
