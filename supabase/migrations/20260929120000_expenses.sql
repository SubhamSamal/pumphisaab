-- ════════════════════════════════════════════════════════════════════════════
--  Migration 11 · 20260929120000_expenses   (Phase 4, slice 4e)
--
--  WHAT IT DOES
--    • expenses: every rupee paid out in the day (canvas F7, PRD F8, D28, D33): the type (from the
--      pump's expense types), what it was (required for "Other"), the amount, and where the money
--      came from: a shift's cash drawer, the owner, or the bank. Fixed/variable is copied from the
--      type by the database (never asked). "Cash advance to credit customer" may name the company.
--    • v_shift_money: cash paid out of a shift's drawer is now added back to that shift's
--      Received (it was received, then spent), same as src/calc/money.ts. Until now it was 0.
--    • v_day_expenses: per day, from shift cash / paid by owner or bank / total.
--    • v_expense_caps: S9, a type over its daily limit (only types with a limit; none set, D72).
--
--  DATA SAFETY:  ADDS NEW THINGS; DELETES NOTHING.
--    • New table expenses (empty), two new views.
--    • Replaces the view v_shift_money with the same columns (drawer_expenses now real).
--    • No DROP · no ALTER of existing tables · no TRUNCATE · no DELETE.
--
--  HOW TO APPLY:  paste the whole file into Supabase › SQL editor › Run, after migration 10.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from public.schema_migrations_applied where name = '20260928120000_margin_and_chamber_dips') then
    raise exception 'Apply migration 10 (20260928120000_margin_and_chamber_dips) first.';
  end if;
  if exists (select 1 from public.schema_migrations_applied where name = '20260929120000_expenses') then
    raise exception 'Migration 20260929120000_expenses was already applied. Nothing was changed.';
  end if;
end $$;


-- ─── 1. Expenses ───────────────────────────────────────────────────────────
create table public.expenses (
  id            uuid primary key default gen_random_uuid(),   -- made on the phone (safe to repeat)
  pump_id       uuid not null references public.pumps (id),
  day_id        uuid not null references public.business_days (id),
  category_id   uuid not null references public.expense_categories (id),
  -- Copied from the type on save (PRD F8: set by the app, not asked).
  expense_type  text not null default 'VARIABLE' check (expense_type in ('FIXED', 'VARIABLE')),
  description   text,
  -- Filled with the business day on save.
  expense_date  date,
  amount        numeric(12, 2) not null check (amount > 0),        -- H5
  paid_from     text not null check (paid_from in ('SHIFT_A', 'SHIFT_B', 'SHIFT_C', 'OWNER', 'BANK')),
  -- Only for "Cash advance to credit customer" (D28), and optional.
  customer_id   uuid references public.credit_customers (id),
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_by    uuid,
  updated_at    timestamptz not null default now(),
  version       integer not null default 1
);
create index expenses_day on public.expenses (day_id);

-- Everything on the row belongs to the same pump; "Other" needs a description.
create function private.check_expense()
returns trigger language plpgsql
as $$
declare
  v_cat public.expense_categories;
begin
  select * into v_cat from public.expense_categories c where c.id = new.category_id and c.pump_id = new.pump_id;
  if not found then
    raise exception 'That expense type belongs to another pump.';
  end if;
  if new.customer_id is not null
     and not exists (select 1 from public.credit_customers c where c.id = new.customer_id and c.pump_id = new.pump_id) then
    raise exception 'That customer belongs to another pump.';
  end if;
  if tg_op = 'UPDATE' and new.day_id is distinct from old.day_id then
    raise exception 'This can''t be moved to another day.';
  end if;
  new.description := nullif(trim(coalesce(new.description, '')), '');
  if lower(v_cat.name) = 'other' and new.description is null then
    raise exception 'Write what the expense was.' using errcode = 'P0001';
  end if;
  new.expense_type := v_cat.default_type;
  new.expense_date := (select d.business_date from public.business_days d where d.id = new.day_id and d.pump_id = new.pump_id);
  if new.expense_date is null then
    raise exception 'That day belongs to another pump.';
  end if;
  return new;
end;
$$;

create trigger check_expense before insert or update on public.expenses for each row execute function private.check_expense();
create trigger day_must_be_open before insert or update or delete on public.expenses for each row execute function private.day_must_be_open();
select private.add_standard_triggers('public.expenses');

alter table public.expenses enable row level security;
-- D73: owner and managers can add any expense (also paid by the owner or bank).
create policy "Members read" on public.expenses for select to authenticated using (private.is_member(pump_id));
create policy "Members add" on public.expenses for insert to authenticated with check (private.is_member(pump_id));
create policy "Members change" on public.expenses for update to authenticated using (private.is_member(pump_id)) with check (private.is_member(pump_id));
create policy "Members remove" on public.expenses for delete to authenticated using (private.is_member(pump_id));


-- ─── 2. The money check per shift, now with drawer expenses ────────────────
-- Same as migration 8, except drawer_expenses: cash paid out of this shift's drawer.
create or replace view public.v_shift_money with (security_invoker = true) as
with base as (
  select
    c.shift_id, c.day_id, c.pump_id, c.shift_code, c.cash_counted_yet, c.cash_counted,
    s.opening_cash as opening_cash_typed,
    coalesce(s.opening_cash,
             (select pc.cash_counted from public.v_shift_cash pc
              where pc.pump_id = c.pump_id and pc.starts_at < c.starts_at and pc.cash_counted_yet
                and pc.starts_at = (select max(p2.starts_at) from public.shifts p2 where p2.pump_id = c.pump_id and p2.starts_at < c.starts_at)),
             0) as opening_cash,
    d.price_confirmed, d.ms_price, d.hsd_price,
    (select meter_litres - test_litres from public.v_shift_litres l where l.shift_id = c.shift_id and l.product = 'MS') as ms_litres,
    (select meter_litres - test_litres from public.v_shift_litres l where l.shift_id = c.shift_id and l.product = 'HSD') as hsd_litres,
    coalesce((select sum(p.amount) from public.shift_payments p join public.payment_types t on t.id = p.payment_type_id
              where p.shift_id = c.shift_id and t.kind = 'OTHER'), 0) as other_payments,
    coalesce((select sum(cs.rupees) from public.credit_sales cs where cs.shift_id = c.shift_id), 0) as credit_slips,
    coalesce((select sum(e.amount) from public.expenses e where e.day_id = c.day_id and e.paid_from = 'SHIFT_' || c.shift_code), 0) as drawer_expenses,
    coalesce((select sum(cp.amount) from public.customer_payments cp where cp.shift_id = c.shift_id), 0) as dues_taken_off,
    (select (pu.rules -> 'shiftMoney' ->> 'flagBeyondRupees')::numeric from public.pumps pu where pu.id = c.pump_id) as limit_rupees
  from public.v_shift_cash c
  join public.shifts s on s.id = c.shift_id
  join public.v_business_days d on d.id = c.day_id
),
money as (
  select b.*,
    case when b.price_confirmed
              and (b.ms_litres = 0 or b.ms_price is not null) and (b.hsd_litres = 0 or b.hsd_price is not null)
         then b.ms_litres * coalesce(b.ms_price, 0) + b.hsd_litres * coalesce(b.hsd_price, 0) end as should_have,
    b.cash_counted - b.opening_cash + b.other_payments + b.credit_slips + b.drawer_expenses - b.dues_taken_off as received_all
  from base b
)
select
  m.shift_id, m.day_id, m.pump_id, m.shift_code, m.cash_counted_yet, m.cash_counted, m.opening_cash,
  m.other_payments, m.credit_slips, m.drawer_expenses, m.dues_taken_off, m.should_have,
  case when m.cash_counted_yet and m.should_have is not null then m.received_all end as received,
  case when m.cash_counted_yet and m.should_have is not null then m.received_all - m.should_have end as difference,
  case when m.cash_counted_yet and m.should_have is not null then abs(m.received_all - m.should_have) > m.limit_rupees end as s2_flag
from money m;


-- ─── 3. Day totals and S9 ──────────────────────────────────────────────────
create view public.v_day_expenses with (security_invoker = true) as
select
  d.id as day_id, d.pump_id,
  coalesce(sum(e.amount) filter (where e.paid_from like 'SHIFT_%'), 0) as from_shift_cash,
  coalesce(sum(e.amount) filter (where e.paid_from in ('OWNER', 'BANK')), 0) as by_owner_or_bank,
  coalesce(sum(e.amount), 0) as total,
  count(e.id) as expense_count
from public.business_days d
left join public.expenses e on e.day_id = d.id
group by d.id, d.pump_id;

-- S9: a type with a daily limit (expense_categories.daily_cap) that went over it.
create view public.v_expense_caps with (security_invoker = true) as
select e.day_id, e.pump_id, c.id as category_id, c.name, c.daily_cap, sum(e.amount) as spent,
       sum(e.amount) > c.daily_cap as s9_flag
from public.expenses e
join public.expense_categories c on c.id = e.category_id
where c.daily_cap is not null
group by e.day_id, e.pump_id, c.id, c.name, c.daily_cap;

grant select on public.v_day_expenses, public.v_expense_caps to authenticated;
revoke select on public.v_day_expenses, public.v_expense_caps from anon;


insert into public.schema_migrations_applied (name) values ('20260929120000_expenses');
