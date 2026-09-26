-- Row Level Security: each pump sees only its own data; only the owner changes setup.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- ── Setup (as the database owner) ─────────────────────────────────────────
-- Pump X is the seeded pilot pump. Pump Y is a second pump made up for this test.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner.x@users.pumphisaab.com'),
  ('22222222-2222-2222-2222-222222222222', 'manager.x@users.pumphisaab.com'),
  ('33333333-3333-3333-3333-333333333333', 'manager.y@users.pumphisaab.com'),
  ('44444444-4444-4444-4444-444444444444', 'gone.x@users.pumphisaab.com');

create temp table ids on commit drop as
select (select id from public.pumps where name = 'Shree Lokanath Filling Station') as x, gen_random_uuid() as y;
grant select on ids to authenticated, anon;

insert into public.pumps (id, name, rules) select y, 'Pump Y', '{}'::jsonb from ids;
insert into public.pump_members (pump_id, user_id, username, full_name, role) values
  ((select x from ids), '11111111-1111-1111-1111-111111111111', 'owner.x', 'Owner X', 'OWNER'),
  ((select x from ids), '22222222-2222-2222-2222-222222222222', 'manager.x', 'Manager X', 'MANAGER'),
  ((select y from ids), '33333333-3333-3333-3333-333333333333', 'manager.y', 'Manager Y', 'MANAGER'),
  ((select x from ids), '44444444-4444-4444-4444-444444444444', 'gone.x', 'Switched off', 'MANAGER');
update public.pump_members set is_active = false where username = 'gone.x';
insert into public.fuel_prices (pump_id, product, per_litre, starts_on) select y, 'HSD', 99.00, '2026-09-01' from ids;
insert into public.staff (pump_id, name) select y, 'Y attendant' from ids;

-- ── Manager of pump X ─────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is((select count(*) from public.pumps), 1::bigint, 'Manager X sees only pump X');
select is((select count(*) from public.tanks), 2::bigint, 'Manager X sees pump X''s 2 tanks');
select is((select count(*) from public.fuel_prices where pump_id = (select y from ids)), 0::bigint, 'Manager X can''t see pump Y''s prices (PRD acceptance 17)');
select is((select count(*) from public.staff where pump_id = (select y from ids)), 0::bigint, 'Manager X can''t see pump Y''s staff');
select throws_ok(
  $$ insert into public.fuel_prices (pump_id, product, per_litre, starts_on) values ((select x from ids), 'MS', 1.00, '2026-12-01') $$,
  '42501', null, 'Manager X can''t add a price (only the owner sets prices)'
);
update public.fuel_prices set per_litre = 1.00 where pump_id = (select x from ids);
select is(
  (select array_agg(per_litre order by product) from public.fuel_prices where pump_id = (select x from ids)),
  array[101.74, 110.07]::numeric[], 'Manager X can''t change a price (the change is ignored)'
);
select lives_ok(
  $$ insert into public.staff (pump_id, name) values ((select x from ids), 'Ramesh') $$,
  'Manager X can add staff (decision D38)'
);
select throws_ok(
  $$ insert into public.staff (pump_id, name) values ((select y from ids), 'Sneaky') $$,
  '42501', null, 'Manager X can''t add staff to pump Y'
);
select throws_ok(
  $$ update public.pump_members set role = 'OWNER' where username = 'manager.x' $$,
  '42501', null, 'Manager X can''t make themselves owner'
);
select is((select count(*) from public.audit_log), 0::bigint, 'Manager X can''t read the audit log');

-- ── Owner of pump X ───────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.fuel_prices (pump_id, product, per_litre, starts_on) values ((select x from ids), 'MS', 111.00, '2026-10-01') $$,
  'Owner X can add a price'
);
select throws_ok(
  $$ insert into public.fuel_prices (pump_id, product, per_litre, starts_on) values ((select y from ids), 'MS', 1.00, '2026-10-01') $$,
  '42501', null, 'Owner X can''t add a price to pump Y'
);
select ok((select count(*) from public.audit_log) > 0, 'Owner X can read pump X''s audit log');
select is((select count(*) from public.audit_log where pump_id = (select y from ids)), 0::bigint, 'Owner X can''t read pump Y''s audit log');
select throws_ok(
  $$ update public.pump_members set is_active = false where username = 'owner.x' $$,
  'P0001', 'The owner''s login can''t be switched off.', 'The owner''s login can''t be switched off'
);

-- ── A switched-off login and a signed-out visitor ─────────────────────────
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is((select count(*) from public.tanks), 0::bigint, 'A switched-off login sees nothing');

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is((select count(*) from public.pumps), 0::bigint, 'Someone not signed in sees nothing');

select * from finish();
rollback;
