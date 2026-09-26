-- Audit log and automatic stamps (CLAUDE.md hard rule 5, PRD F14).
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'owner.x@users.pumphisaab.com');
create temp table ids on commit drop as select (select id from public.pumps where name = 'Shree Lokanath Filling Station') as x;
grant select on ids to authenticated;
insert into public.pump_members (pump_id, user_id, username, full_name, role)
  select x, '11111111-1111-1111-1111-111111111111', 'owner.x', 'Owner X', 'OWNER' from ids;

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- The app tries to fake who created the row; the stamp overrides it.
insert into public.staff (pump_id, name, created_by, version)
  select x, 'Suresh', '99999999-9999-9999-9999-999999999999', 7 from ids;
select is((select created_by from public.staff where name = 'Suresh'), '11111111-1111-1111-1111-111111111111'::uuid, 'Created-by is always the real login, never what the app sends');
select is((select version from public.staff where name = 'Suresh'), 1, 'A new row starts at version 1');

update public.staff set name = 'Suresh K' where name = 'Suresh';
select is((select version from public.staff where name = 'Suresh K'), 2, 'Each change adds 1 to the version');

select throws_ok(
  $$ update public.staff set name = 'Suresh Old', version = 1 where name = 'Suresh K' $$,
  '40001', 'Someone else changed this just now. Reload and try again.',
  'A change based on an old version is refused instead of silently overwriting'
);
select lives_ok($$ update public.staff set name = 'Suresh Kumar', version = 2 where name = 'Suresh K' $$, 'A change based on the current version is saved');

delete from public.staff where name = 'Suresh Kumar';
select is(
  (select array_agg(action order by seq) from public.audit_log where table_name = 'staff'),
  array['INSERT', 'UPDATE', 'UPDATE', 'DELETE'],
  'Every insert, change and delete is in the audit log'
);
select is(
  (select count(*) from public.audit_log where table_name = 'staff' and changed_by = '11111111-1111-1111-1111-111111111111'),
  4::bigint, 'The audit log records who made each change'
);
select is(
  (select old_values ->> 'name' || ' → ' || (new_values ->> 'name') from public.audit_log where table_name = 'staff' and action = 'UPDATE' order by seq limit 1),
  'Suresh → Suresh K', 'The audit log keeps the old and new values'
);

reset role;
select throws_ok($$ update public.audit_log set action = 'INSERT' $$, 'P0001', 'The audit log can''t be changed or deleted.', 'Nobody can change the audit log, not even the database owner');
select throws_ok($$ delete from public.audit_log $$, 'P0001', 'The audit log can''t be changed or deleted.', 'Nobody can delete the audit log');
select throws_ok($$ update public.dip_chart_rows set volume_l = 1 where dip_cm = 100 $$, 'P0001', 'A saved dip chart can''t be changed. Upload a new version instead.', 'A saved dip chart can''t be changed');
select throws_ok(
  $$ insert into public.nozzles (pump_id, label, product, tank_id) select x, 'Wrong', 'MS', (select id from public.tanks where label = 'HSD-1') from ids $$,
  'P0001', 'A nozzle must be linked to a tank of the same fuel at the same pump.', 'A petrol nozzle can''t be linked to the diesel tank'
);

select * from finish();
rollback;
