-- ════════════════════════════════════════════════════════════════════════════
--  Migration 8 · 20260927150000_sales   (Phase 4, slice 4d)
--
--  WHAT IT DOES
--    • shift_payments: per shift, one ₹ total per way of getting paid (Paytm, Card, XtraPower,
--      Bank transfer), and the coins for Cash. ₹0 is a real answer ("none").
--    • cash_counts: the cash note count per shift (₹500 × n, ₹200 × n …).
--    • credit_sales: credit slips, typed in ₹ or in litres (D27); the other one is worked out by
--      the database at the day's confirmed price. A slip number can never be used twice (H7).
--    • customer_payments: customers paying old dues or advances (D29, D47). Dues paid by Cash,
--      Paytm, Card or XtraPower carry the shift whose total holds them (taken off that shift);
--      dues paid by bank transfer carry no shift (recorded only).
--    • Shifts: cash already in the drawer at the start (prefilled from the last count, D46) and
--      "Sales done" can now be saved by the app.
--    • Managers can add a new credit customer (D50).
--    • v_shift_money: Should have / Received / Difference per shift and S2, the same maths as
--      src/calc/money.ts (hard rule 4). day_problems() now also lists H9.
--
--  DATA SAFETY:  ADDS NEW THINGS; CHANGES PERMISSIONS ONLY; DELETES NOTHING.
--    • Adds two security rules to credit_customers (managers may add and rename) and lets the
--      app save two columns on shifts. No existing row is changed.
--    • Replaces the function day_problems() with the same one plus H9.
--    • No DROP · no ALTER of existing tables · no TRUNCATE · no DELETE.
--
--  HOW TO APPLY:  paste the whole file into Supabase › SQL editor › Run, after migration 7.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from public.schema_migrations_applied where name = '20260927140000_tanker') then
    raise exception 'Apply migration 7 (20260927140000_tanker) first.';
  end if;
  if exists (select 1 from public.schema_migrations_applied where name = '20260927150000_sales') then
    raise exception 'Migration 20260927150000_sales was already applied. Nothing was changed.';
  end if;
end $$;


-- ─── 1. Totals per way of getting paid, per shift ──────────────────────────
create table public.shift_payments (
  id               uuid primary key default gen_random_uuid(),
  pump_id          uuid not null references public.pumps (id),
  day_id           uuid not null references public.business_days (id),
  shift_id         uuid not null references public.shifts (id),
  payment_type_id  uuid not null references public.payment_types (id),
  -- Paytm, Card, XtraPower, Bank transfer: the shift's total from the machine / app / bank.
  amount           numeric(12, 2) check (amount >= 0),                  -- H5
  -- Cash: the coins (the notes are in cash_counts).
  coins            numeric(12, 2) check (coins >= 0),                   -- H5
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_by       uuid,
  updated_at       timestamptz not null default now(),
  version          integer not null default 1,
  unique (shift_id, payment_type_id)
);


-- ─── 2. Cash note count ────────────────────────────────────────────────────
create table public.cash_counts (
  id               uuid primary key default gen_random_uuid(),
  pump_id          uuid not null references public.pumps (id),
  day_id           uuid not null references public.business_days (id),
  shift_id         uuid not null references public.shifts (id),
  denomination_id  uuid not null references public.cash_denominations (id),
  note_count       integer not null default 0 check (note_count >= 0), -- H5
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_by       uuid,
  updated_at       timestamptz not null default now(),
  version          integer not null default 1,
  unique (shift_id, denomination_id)
);


-- ─── 3. Credit slips ───────────────────────────────────────────────────────
create table public.credit_sales (
  id           uuid primary key default gen_random_uuid(),   -- made on the phone (safe to repeat)
  pump_id      uuid not null references public.pumps (id),
  day_id       uuid not null references public.business_days (id),
  shift_id     uuid not null references public.shifts (id),
  customer_id  uuid not null references public.credit_customers (id),
  vehicle_no   text not null check (vehicle_no ~ '^[A-Z0-9]{4,12}$'),
  slip_no      text not null check (length(trim(slip_no)) > 0),
  product      text not null check (product in ('MS', 'HSD')),
  -- Typed in rupees (a round fill) or in litres (D27). The other is worked out on save.
  entry_by     text not null check (entry_by in ('RUPEES', 'LITRES')),
  rupees       numeric(12, 2) not null check (rupees > 0),         -- H5
  litres       numeric(12, 2) not null check (litres > 0),         -- H5
  rate         numeric(8, 2) not null,                             -- the day's confirmed price
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_by   uuid,
  updated_at   timestamptz not null default now(),
  version      integer not null default 1
);
-- H7: a slip number can never be used twice at a pump (any customer, any day; D31).
create unique index credit_sales_slip_unique on public.credit_sales (pump_id, upper(trim(slip_no)));
create index credit_sales_shift on public.credit_sales (shift_id);


-- ─── 4. Payments from customers (old dues or advances; not fuel) ───────────
create table public.customer_payments (
  id               uuid primary key default gen_random_uuid(),
  pump_id          uuid not null references public.pumps (id),
  day_id           uuid not null references public.business_days (id),
  -- The shift whose total already holds this money (taken off it). Empty for bank transfers (D47).
  shift_id         uuid references public.shifts (id),
  customer_id      uuid not null references public.credit_customers (id),
  payment_type_id  uuid not null references public.payment_types (id),   -- how it was paid
  amount           numeric(12, 2) not null check (amount > 0),           -- H5
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_by       uuid,
  updated_at       timestamptz not null default now(),
  version          integer not null default 1
);
create index customer_payments_day on public.customer_payments (day_id);


-- ─── 5. Checks on every save ───────────────────────────────────────────────
-- Everything on a row belongs to the same pump and day (shift, type, note, customer).
create function private.check_sales_row()
returns trigger language plpgsql
as $$
declare
  v jsonb := to_jsonb(new);
begin
  if v ->> 'shift_id' is not null
     and not exists (select 1 from public.shifts s where s.id = (v ->> 'shift_id')::uuid and s.day_id = new.day_id and s.pump_id = new.pump_id) then
    raise exception 'That shift belongs to another day or pump.';
  end if;
  if v ? 'payment_type_id'
     and not exists (select 1 from public.payment_types t where t.id = (v ->> 'payment_type_id')::uuid and t.pump_id = new.pump_id) then
    raise exception 'That way of payment belongs to another pump.';
  end if;
  if v ? 'denomination_id'
     and not exists (select 1 from public.cash_denominations c where c.id = (v ->> 'denomination_id')::uuid and c.pump_id = new.pump_id) then
    raise exception 'That note belongs to another pump.';
  end if;
  if v ? 'customer_id'
     and not exists (select 1 from public.credit_customers c where c.id = (v ->> 'customer_id')::uuid and c.pump_id = new.pump_id) then
    raise exception 'That customer belongs to another pump.';
  end if;
  if tg_op = 'UPDATE' and new.day_id is distinct from old.day_id then
    raise exception 'This can''t be moved to another day.';
  end if;
  return new;
end;
$$;

-- Credit slip: the rate is the day's confirmed price (H6: nothing money-related before Confirm),
-- and ₹ ↔ litres follow D27 and the pump's rules: litres from ₹ are rounded UP to 2 decimals
-- (creditSlip.litreRounding "up"), ₹ from litres to the paisa, half-up. Same as src/calc/credit.ts.
create function private.fill_credit_slip()
returns trigger language plpgsql
as $$
declare
  v_day public.business_days;
  v_rules jsonb;
  v_decimals int;
  v_scale numeric;
begin
  select * into v_day from public.business_days where id = new.day_id;
  if v_day.price_confirmed_at is null
     or v_day.ms_price is distinct from public.price_for(v_day.pump_id, 'MS', v_day.business_date)
     or v_day.hsd_price is distinct from public.price_for(v_day.pump_id, 'HSD', v_day.business_date) then
    raise exception 'Confirm today''s price on Today before adding a credit slip.' using errcode = 'P0001', hint = 'H6';
  end if;
  new.rate := case new.product when 'MS' then v_day.ms_price else v_day.hsd_price end;
  new.vehicle_no := upper(regexp_replace(new.vehicle_no, '[\s-]', '', 'g'));
  new.slip_no := trim(new.slip_no);

  select p.rules into v_rules from public.pumps p where p.id = new.pump_id;
  v_decimals := coalesce((v_rules -> 'creditSlip' ->> 'litreDecimals')::int, 2);
  v_scale := power(10::numeric, v_decimals);
  if new.entry_by = 'RUPEES' then
    if new.rupees is null then raise exception 'Type the rupees on the slip.'; end if;
    new.litres := case when coalesce(v_rules -> 'creditSlip' ->> 'litreRounding', 'up') = 'up'
                       then ceil(new.rupees / new.rate * v_scale) / v_scale
                       else round(new.rupees / new.rate, v_decimals) end;
  else
    if new.litres is null then raise exception 'Type the litres on the slip.'; end if;
    new.rupees := round(new.litres * new.rate, 2);
  end if;
  return new;
end;
$$;

-- A clearer message than "duplicate key" for H7: which customer already has this slip.
create function private.slip_not_used()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_who text;
begin
  select c.name into v_who
  from public.credit_sales s join public.credit_customers c on c.id = s.customer_id
  where s.pump_id = new.pump_id and upper(trim(s.slip_no)) = upper(trim(new.slip_no)) and s.id <> new.id
  limit 1;
  if v_who is not null then
    raise exception 'Slip % is already saved for %. Check the slip number.', trim(new.slip_no), v_who
      using errcode = '23505', hint = 'H7';
  end if;
  return new;
end;
$$;

create trigger check_sales_row before insert or update on public.shift_payments for each row execute function private.check_sales_row();
create trigger check_sales_row before insert or update on public.cash_counts for each row execute function private.check_sales_row();
create trigger check_sales_row before insert or update on public.credit_sales for each row execute function private.check_sales_row();
create trigger check_sales_row before insert or update on public.customer_payments for each row execute function private.check_sales_row();
create trigger fill_credit_slip before insert or update on public.credit_sales for each row execute function private.fill_credit_slip();
create trigger slip_not_used before insert or update on public.credit_sales for each row execute function private.slip_not_used();

create trigger day_must_be_open before insert or update or delete on public.shift_payments for each row execute function private.day_must_be_open();
create trigger day_must_be_open before insert or update or delete on public.cash_counts for each row execute function private.day_must_be_open();
create trigger day_must_be_open before insert or update or delete on public.credit_sales for each row execute function private.day_must_be_open();
create trigger day_must_be_open before insert or update or delete on public.customer_payments for each row execute function private.day_must_be_open();

select private.add_standard_triggers('public.shift_payments');
select private.add_standard_triggers('public.cash_counts');
select private.add_standard_triggers('public.credit_sales');
select private.add_standard_triggers('public.customer_payments');


-- ─── 6. Row Level Security ─────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['shift_payments', 'cash_counts', 'credit_sales', 'customer_payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Members read" on public.%I for select to authenticated using (private.is_member(pump_id))', t);
    execute format('create policy "Members add" on public.%I for insert to authenticated with check (private.is_member(pump_id))', t);
    execute format('create policy "Members change" on public.%I for update to authenticated using (private.is_member(pump_id)) with check (private.is_member(pump_id))', t);
    execute format('create policy "Members remove" on public.%I for delete to authenticated using (private.is_member(pump_id))', t);
  end loop;
end $$;

-- Shifts: the app may now save the drawer's opening cash and "Sales done" (the rest stays the database's).
-- (Migration 6 already lets members update their pump's shifts; only these columns are opened.)
grant update (opening_cash, sales_done_at, version) on public.shifts to authenticated;

-- Credit customers: a manager can add a new company while adding a slip, and fix its name (D50).
create policy "Managers add customers" on public.credit_customers
  for insert to authenticated with check (private.is_member(pump_id));
create policy "Managers change customers" on public.credit_customers
  for update to authenticated using (private.is_member(pump_id)) with check (private.is_member(pump_id));


-- ─── 7. The money check per shift: same maths as src/calc/money.ts ─────────
--   Should have = Σ fuel (sold as per meters × the day's confirmed price)
--   Received    = cash counted − cash already in the drawer at the start
--               + Paytm + Card + XtraPower + Bank transfer + credit slips
--               + expenses paid from this shift's drawer (slice 4e)
--               − customer payments held in this shift's totals (D29, D47)
--   Difference  = Received − Should have   (S2 beyond shiftMoney.flagBeyondRupees)
-- Nothing is worked out until the cash is counted (a Cash row exists) and the price is confirmed.
-- Cash at the start, when not typed, is the previous shift's counted cash (D46).
create view public.v_shift_cash with (security_invoker = true) as
select
  s.id as shift_id, s.day_id, s.pump_id, s.shift_code, s.starts_at,
  exists (select 1 from public.shift_payments p join public.payment_types t on t.id = p.payment_type_id
          where p.shift_id = s.id and t.kind = 'CASH') as cash_counted_yet,
  coalesce((select sum(c.note_count * d.value) from public.cash_counts c join public.cash_denominations d on d.id = c.denomination_id
            where c.shift_id = s.id), 0)
  + coalesce((select sum(p.coins) from public.shift_payments p join public.payment_types t on t.id = p.payment_type_id
              where p.shift_id = s.id and t.kind = 'CASH'), 0) as cash_counted
from public.shifts s;

create view public.v_shift_money with (security_invoker = true) as
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
    0::numeric as drawer_expenses,   -- slice 4e fills this in
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

grant select on public.v_shift_cash, public.v_shift_money to authenticated;
revoke select on public.v_shift_cash, public.v_shift_money from anon;


-- ─── 8. What blocks a day: now also H9 ─────────────────────────────────────
--   H9  credit litres of a fuel in a shift more than that fuel's litres sold as per meters
create or replace function public.day_problems(p_day uuid)
returns table (code text, shift_code text, nozzle_label text, message text)
language sql stable security invoker set search_path = ''
as $$
  select 'H2', s.shift_code, n.label,
         n.label || ': opening ' || r.opening || ' isn''t the last closing. Waiting for the owner to approve the meter change.'
  from public.nozzle_readings r
  join public.shifts s on s.id = r.shift_id
  join public.nozzles n on n.id = r.nozzle_id
  where r.day_id = p_day and r.meter_change_status = 'PENDING' and n.in_use
  union all
  select 'H8', s.shift_code, n.label,
         n.label || ': ' || t.tested || ' L tested but the meter shows only ' || (r.closing - r.opening) || ' L sold this shift.'
  from (select shift_id, nozzle_id, sum(litres) as tested from public.nozzle_tests where day_id = p_day group by 1, 2) t
  join public.shifts s on s.id = t.shift_id
  join public.nozzles n on n.id = t.nozzle_id
  join public.nozzle_readings r on r.shift_id = t.shift_id and r.nozzle_id = t.nozzle_id
  where n.in_use and r.closing >= r.opening and t.tested > r.closing - r.opening
  union all
  select 'H9', c.shift_code, null,
         'Shift ' || c.shift_code || ': ' || c.product || ' credit slips add up to ' || c.credit_l || ' L, more than the '
           || (l.meter_litres - l.test_litres) || ' L the meters sold.'
  from (select s.id as shift_id, s.shift_code, cs.product, sum(cs.litres) as credit_l
        from public.credit_sales cs join public.shifts s on s.id = cs.shift_id
        where cs.day_id = p_day group by 1, 2, 3) c
  join public.v_shift_litres l on l.shift_id = c.shift_id and l.product = c.product
  where c.credit_l > l.meter_litres - l.test_litres;
$$;


insert into public.schema_migrations_applied (name) values ('20260927150000_sales');
