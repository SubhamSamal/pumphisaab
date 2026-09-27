-- Slice 4e: expenses (PRD F8, canvas F7, D28, D72, D73): table rules, drawer expenses in the
-- shift's money, day totals, S9, locked day, security.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email) values
  ('22222222-2222-2222-2222-222222222222', 'manager.x@users.pumphisaab.com'),
  ('33333333-3333-3333-3333-333333333333', 'manager.y@users.pumphisaab.com');

create temp table ids on commit drop as
select
  p.id as x,
  gen_random_uuid() as y,
  public.current_business_date(p.id) as today,
  (select id from public.nozzles where pump_id = p.id and label = 'HSD-3') as hsd3,
  (select id from public.payment_types where pump_id = p.id and name = 'Cash') as cash,
  (select id from public.expense_categories where pump_id = p.id and name = 'Tiffin') as tiffin,
  (select id from public.expense_categories where pump_id = p.id and name = 'Salary') as salary,
  (select id from public.expense_categories where pump_id = p.id and name = 'Other') as other,
  (select id from public.expense_categories where pump_id = p.id and name = 'Bakshis') as bakshis,
  gen_random_uuid() as old_day
from public.pumps p where p.name = 'Shree Lokanath Filling Station';
grant select on ids to authenticated, anon;

insert into public.pump_members (pump_id, user_id, username, full_name, role) values
  ((select x from ids), '22222222-2222-2222-2222-222222222222', 'manager.x', 'Manager X', 'MANAGER');
insert into public.pumps (id, name, rules) select y, 'Pump Y', '{}'::jsonb from ids;
insert into public.pump_members (pump_id, user_id, username, full_name, role) values
  ((select y from ids), '33333333-3333-3333-3333-333333333333', 'manager.y', 'Manager Y', 'MANAGER');
insert into public.business_days (id, pump_id, business_date, status) select old_day, x, today - 6, 'LOCKED' from ids;
update public.expense_categories set daily_cap = 300 where id = (select bakshis from ids);   -- only in this test (D72)

set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
create temp table d on commit drop as select public.open_day((select x from ids)) as day;
create temp table s on commit drop as select
  (select id from public.shifts where day_id = (select day from d) and shift_code = 'A') as a;
select public.confirm_prices((select day from d));

-- Shift A: 100 L HSD at ₹101.74 = ₹10,174 should have. Cash counted ₹9,724, ₹450 tiffin paid from the drawer.
insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, opening, opening_typed, closing)
  select x, (select day from d), (select a from s), hsd3, 1000, true, 1100 from ids;
update public.shifts set opening_cash = 0 where id = (select a from s);
insert into public.shift_payments (pump_id, day_id, shift_id, payment_type_id, coins) select x, (select day from d), (select a from s), cash, 9724 from ids;
select is((select difference from public.v_shift_money where shift_id = (select a from s)), -450.00, 'Before the expense: Shift A is ₹450 short');

select lives_ok($$ insert into public.expenses (pump_id, day_id, category_id, amount, paid_from)
  select x, (select day from d), tiffin, 450, 'SHIFT_A' from ids $$, 'A manager adds a tiffin paid from Shift A''s drawer');
select is((select difference from public.v_shift_money where shift_id = (select a from s)), 0.00, 'Drawer expense is added back: Shift A matches');
select is((select drawer_expenses from public.v_shift_money where shift_id = (select a from s)), 450.00, 'v_shift_money shows the drawer expense');
select is((select expense_type || ' ' || expense_date::text from public.expenses where category_id = (select tiffin from ids)),
  'VARIABLE ' || (select today from ids)::text, 'Fixed/variable comes from the type, the date from the day');

select lives_ok($$ insert into public.expenses (pump_id, day_id, category_id, amount, paid_from)
  select x, (select day from d), salary, 18000, 'OWNER' from ids $$, 'D73: a manager adds a salary paid by the owner');
select is((select difference from public.v_shift_money where shift_id = (select a from s)), 0.00, 'Owner-paid expenses don''t touch any shift');
select is((select from_shift_cash::text || ' / ' || by_owner_or_bank::text || ' / ' || total::text from public.v_day_expenses where day_id = (select day from d)),
  '450.00 / 18000.00 / 18450.00', 'Day totals: from shift cash / by owner or bank / total');

select throws_ok($$ insert into public.expenses (pump_id, day_id, category_id, amount, paid_from)
  select x, (select day from d), other, 2000, 'SHIFT_B' from ids $$, 'P0001', 'Write what the expense was.', '"Other" needs a description');
select throws_ok($$ insert into public.expenses (pump_id, day_id, category_id, amount, paid_from)
  select x, (select day from d), tiffin, 0, 'SHIFT_A' from ids $$, '23514', null, 'H5: amount must be more than 0');
select throws_ok($$ insert into public.expenses (pump_id, day_id, category_id, amount, paid_from)
  select x, (select day from d), tiffin, 10, 'SHIFT_D' from ids $$, '23514', null, 'Paid from must be a shift, the owner or the bank');

insert into public.expenses (pump_id, day_id, category_id, amount, paid_from) select x, (select day from d), bakshis, 500, 'SHIFT_A' from ids;
select is((select s9_flag from public.v_expense_caps where day_id = (select day from d) and category_id = (select bakshis from ids)), true,
  'S9: Bakshis ₹500 is over its ₹300 daily limit');

select throws_ok($$ insert into public.expenses (pump_id, day_id, category_id, amount, paid_from)
  select x, old_day, tiffin, 100, 'SHIFT_A' from ids $$, 'P0001', null, 'A locked day can''t get an expense');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*) from public.expenses), 0::bigint, 'Pump Y sees none of pump X''s expenses');
select throws_ok($$ insert into public.expenses (pump_id, day_id, category_id, amount, paid_from)
  select x, (select day from d), tiffin, 100, 'SHIFT_A' from ids $$, 'P0001', 'That expense type belongs to another pump.', 'and can''t add one to pump X (it can''t even see its types)');

select * from finish();
rollback;
