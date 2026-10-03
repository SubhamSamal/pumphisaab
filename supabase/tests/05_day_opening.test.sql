-- Slice 4a: business days, price confirm, opening and closing dips, day locking (D49).
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- ── Setup (as the database owner) ─────────────────────────────────────────
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner.x@users.pumphisaab.com'),
  ('22222222-2222-2222-2222-222222222222', 'manager.x@users.pumphisaab.com'),
  ('33333333-3333-3333-3333-333333333333', 'manager.y@users.pumphisaab.com');

create temp table ids on commit drop as
select
  p.id as x,
  gen_random_uuid() as y,
  public.current_business_date(p.id) as today,
  (select id from public.tanks where pump_id = p.id and product = 'HSD') as hsd,
  (select id from public.tanks where pump_id = p.id and product = 'MS') as ms,
  gen_random_uuid() as y_day,
  gen_random_uuid() as old_day,     -- submitted 3 days ago: locked by age
  gen_random_uuid() as recent_day,  -- submitted 2 days ago: still open
  gen_random_uuid() as day5,
  gen_random_uuid() as day4
from public.pumps p where p.name = 'Shree Lokanath Filling Station';
grant select on ids to authenticated, anon;

insert into public.pumps (id, name, rules) select y, 'Pump Y', '{}'::jsonb from ids;
insert into public.pump_members (pump_id, user_id, username, full_name, role) values
  ((select x from ids), '11111111-1111-1111-1111-111111111111', 'owner.x', 'Owner X', 'OWNER'),
  ((select x from ids), '22222222-2222-2222-2222-222222222222', 'manager.x', 'Manager X', 'MANAGER'),
  ((select y from ids), '33333333-3333-3333-3333-333333333333', 'manager.y', 'Manager Y', 'MANAGER');
insert into public.business_days (id, pump_id, business_date) select y_day, y, today from ids;
insert into public.business_days (id, pump_id, business_date) select old_day, x, today - 3 from ids;
insert into public.business_days (id, pump_id, business_date) select recent_day, x, today - 2 from ids;
insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm) select x, old_day, hsd, 'OPENING', 100.0 from ids;
insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm) select x, recent_day, hsd, 'OPENING', 100.0 from ids;
update public.business_days set status = 'SUBMITTED' where id in (select old_day from ids union select recent_day from ids);
-- S7 example: 5 days ago HSD closed at 128.5 cm; 4 days ago it opened at 129.1 cm.
insert into public.business_days (id, pump_id, business_date) select day5, x, today - 5 from ids;
insert into public.business_days (id, pump_id, business_date) select day4, x, today - 4 from ids;
insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm) select x, day5, hsd, 'CLOSING', 128.5 from ids;
insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm) select x, day4, hsd, 'OPENING', 129.1 from ids;
insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm) select x, day5, ms, 'CLOSING', 128.5 from ids;
insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm) select x, day4, ms, 'OPENING', 129.0 from ids;

select is((select first_business_date from public.pumps where id = (select x from ids)), (select today from ids),
  'The pilot pump''s first day in the app is the day the migration was pasted');
select ok((select is_locked from public.v_business_days where id = (select old_day from ids)),
  'A day submitted 3 business days ago is locked by age (D49)');
select ok(not (select is_locked from public.v_business_days where id = (select recent_day from ids)),
  'A day submitted 2 business days ago is still open');
select is((select opening_dip_change_cm from public.v_tank_day where day_id = (select day4 from ids) and product = 'HSD'), 0.6,
  'v_tank_day: opening dip moved 0.6 cm from last night''s closing dip');
select is((select array_agg(product::text order by product) from public.v_tank_day where day_id = (select day4 from ids) and s7_flag),
  array['HSD'], 'S7 fires beyond 0.5 cm (HSD 0.6 cm) and not at exactly 0.5 cm (MS)');

-- ── Manager of pump X ─────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

create temp table opened on commit drop as select public.open_day((select x from ids)) as today_id;
select is((select business_date from public.business_days where id = (select today_id from opened)), (select today from ids),
  'open_day() starts today''s business day (server clock)');
select is(public.open_day((select x from ids)), (select today_id from opened), 'open_day() again gives the same day (safe to repeat)');
select throws_ok($$ select public.open_day((select x from ids), (select today + 1 from ids)) $$,
  'P0001', 'That day hasn''t started yet.', 'Nobody can open a day in the future');
select lives_ok($$ select public.open_day((select x from ids), (select today - 1 from ids)) $$, 'A manager can start yesterday');
select lives_ok($$ select public.open_day((select x from ids), (select today - 10 from ids)) $$, 'D101: a manager can start a day up to 10 days back');
select throws_ok($$ select public.open_day((select x from ids), (select today - 11 from ids)) $$,
  '42501', 'Only the owner can start a day older than 10 days.', 'but not older than 10 days');
select is(public.open_day((select x from ids), (select today - 3 from ids)), (select old_day from ids),
  'A manager can open an older day that already exists');
select throws_ok($$ insert into public.business_days (pump_id, business_date) values ((select x from ids), '2020-01-01') $$,
  '42501', null, 'Days can''t be created directly, only through open_day()');
select throws_ok($$ update public.business_days set status = 'LOCKED' where id = (select today_id from opened) $$,
  '42501', null, 'A manager can''t change a day''s status directly');
select throws_ok($$ update public.business_days set hsd_price = 1.00 where id = (select today_id from opened) $$,
  '42501', null, 'A manager can''t write a price onto the day');

select lives_ok($$ select public.confirm_prices((select today_id from opened)) $$, 'A manager confirms today''s prices');
select is((select array[ms_price, hsd_price] from public.v_business_days where id = (select today_id from opened)),
  array[110.07, 101.74]::numeric[], 'Confirm stores the owner''s prices for the day, read by the database');
select ok((select price_confirmed from public.v_business_days where id = (select today_id from opened)), 'The day shows prices as confirmed');

select lives_ok($$ insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm, book_stock_l, dip_l)
  values ((select x from ids), (select today_id from opened), (select hsd from ids), 'OPENING', 123.4, 13250, 1) $$,
  'A manager saves the opening dip and IOCL report stock');
select is((select round(dip_l, 2) from public.tank_readings where day_id = (select today_id from opened) and tank_id = (select hsd from ids)),
  13215.37, 'The database works out 123.4 cm = 13,215.37 L itself (the app''s litres are ignored)');
select throws_ok($$ insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm)
  values ((select x from ids), (select today_id from opened), (select ms from ids), 'OPENING', 210.1) $$,
  'P0001', null, 'H3: a dip outside the chart is refused');
select throws_ok($$ insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, book_stock_l)
  values ((select x from ids), (select today_id from opened), (select ms from ids), 'OPENING', -5) $$,
  '23514', null, 'H5: a negative IOCL report stock is refused');
select is((select count(*) from public.business_days where pump_id = (select y from ids)), 0::bigint, 'Manager X can''t see pump Y''s days');
select throws_ok($$ insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm)
  values ((select y from ids), (select y_day from ids), (select hsd from ids), 'OPENING', 10) $$,
  'P0001', 'That day belongs to another pump.', 'Manager X can''t write a reading into pump Y (pump Y''s day is invisible to them)');
select throws_ok($$ update public.tank_readings set dip_cm = 101.0 where day_id = (select old_day from ids) $$,
  'P0001', 'This day is locked. Ask the owner to unlock it.', 'Nobody can change a reading on a locked day');
select lives_ok($$ update public.tank_readings set dip_cm = 101.0 where day_id = (select recent_day from ids) $$,
  'A submitted day that isn''t locked can still be fixed');
select throws_ok($$ select public.lock_day((select recent_day from ids)) $$, '42501', null, 'A manager can''t lock a day');

-- ── Owner of pump X ───────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.unlock_day((select old_day from ids));
select public.lock_day((select recent_day from ids));
select throws_ok($$ select public.lock_day((select today_id from opened)) $$, 'P0001', 'This day isn''t submitted yet.',
  'A day that isn''t submitted can''t be locked');
select lives_ok($$ select public.open_day((select x from ids), (select today - 30 from ids)) $$, 'The owner can start an old day (e.g. a notebook day)');

-- Back to the manager: the unlocked day is open, the locked one isn't.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok($$ update public.tank_readings set dip_cm = 102.0 where day_id = (select old_day from ids) $$,
  'After the owner unlocks an old day, the manager can fix it (it stays open until locked)');
select throws_ok($$ update public.tank_readings set dip_cm = 102.0 where day_id = (select recent_day from ids) $$,
  'P0001', 'This day is locked. Ask the owner to unlock it.', 'After the owner locks a day, nobody can change it');

reset role;
select is((select day_status_at_change from public.audit_log where table_name = 'tank_readings' and action = 'UPDATE'
           and record_id = (select id from public.tank_readings where day_id = (select old_day from ids)) order by seq desc limit 1),
  'SUBMITTED', 'The audit log records the day''s status at each change');

select * from finish();
rollback;
