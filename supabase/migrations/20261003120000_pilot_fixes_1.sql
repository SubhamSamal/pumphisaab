-- ════════════════════════════════════════════════════════════════════════════
--  Migration 14 · 20261003120000_pilot_fixes_1   (owner's demo feedback, 03 Oct 2026)
--
--  WHAT IT DOES
--    • A tanker can finish unloading the next day (D97): receipt_chambers.next_day. Chambers
--      unloaded the next day count as received on the next business day; the tanker's day gets
--      the rest, less the challan's short. v_receipt_lines, v_day_received and v_day_match
--      follow (same maths as src/calc/tanker.ts and tank.ts).
--    • Managers can open today and the 10 days before (was 2): one pump setting,
--      rules.managerDaysBack, read here and by the app (D101).
--    • Card is split (D99): "Card" becomes "Debit card" (amounts already typed move with it),
--      and "Credit card" is added after it.
--
--  DATA SAFETY:  ADDS AND RENAMES; DELETES NOTHING.
--    • ALTER TABLE receipt_chambers ADD COLUMN next_day (new, false for every existing chamber).
--    • UPDATE pumps: adds "managerDaysBack": 10 to each pump's rules (nothing else in rules changes).
--    • UPDATE payment_types: renames Card → Debit card and moves the later types one place down;
--      INSERT one new type, Credit card. No payment amount is changed.
--    • Replaces open_day() and three views with the same columns (v_receipt_lines gets one more
--      column at the end). No DROP · no TRUNCATE · no DELETE.
--
--  HOW TO APPLY:  paste the whole file into Supabase › SQL editor › Run, after migration 13.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from public.schema_migrations_applied where name = '20260929140000_expense_types_by_managers') then
    raise exception 'Apply migration 13 (20260929140000_expense_types_by_managers) first.';
  end if;
  if exists (select 1 from public.schema_migrations_applied where name = '20261003120000_pilot_fixes_1') then
    raise exception 'Migration 20261003120000_pilot_fixes_1 was already applied. Nothing was changed.';
  end if;
end $$;


-- ─── 1. Tanker finished the next day (D97) ─────────────────────────────────
alter table public.receipt_chambers add column next_day boolean not null default false;

-- Same as migration 10, plus: litres of the chambers unloaded the next day (at the end).
create or replace view public.v_receipt_lines with (security_invoker = true) as
with rise as (
  select l.id,
    case
      when exists (select 1 from public.receipt_chambers c where c.receipt_line_id = l.id) then
        (select case when bool_and(vc.rise_l is not null) then sum(vc.rise_l) end from public.v_receipt_chambers vc where vc.receipt_line_id = l.id)
      else l.dip_after_l - l.dip_before_l
    end as dip_rise_l,
    coalesce((select sum(c.litres) from public.receipt_chambers c where c.receipt_line_id = l.id and c.next_day), 0) as received_next_day_l
  from public.receipt_lines l
)
select
  l.id, l.pump_id, l.day_id, l.receipt_id, l.product, l.tank_id,
  l.ordered_l, l.short_l, l.price_per_l, l.margin_per_l, l.dip_before_cm, l.dip_after_cm,
  l.ordered_l - l.short_l as received_l,
  l.ordered_l * l.price_per_l as amount,
  l.short_l * l.price_per_l as short_amount,
  (l.ordered_l - l.short_l) * l.margin_per_l as margin,
  r.dip_rise_l,
  l.short_l * 100 / l.ordered_l > (p.rules -> 'tanker' ->> 'shortFlagBeyondPercent')::numeric as s6_short,
  coalesce(abs(r.dip_rise_l - (l.ordered_l - l.short_l)) * 100 / nullif(l.ordered_l - l.short_l, 0)
    > (p.rules -> 'tanker' ->> 'dipCheckFlagBeyondPercent')::numeric, false) as s6_dip,
  r.received_next_day_l
from public.receipt_lines l
join rise r on r.id = l.id
join public.pumps p on p.id = l.pump_id;

-- Litres that went into the tank on each day, per fuel: the tanker's day gets received − next-day
-- chambers; the next business day gets the next-day chambers.
create or replace view public.v_day_received with (security_invoker = true) as
select day_id, pump_id, product, sum(litres) as received_l
from (
  select l.day_id, l.pump_id, l.product, l.received_l - l.received_next_day_l as litres
  from public.v_receipt_lines l
  union all
  select nd.id, l.pump_id, l.product, l.received_next_day_l
  from public.v_receipt_lines l
  join public.business_days d on d.id = l.day_id
  join public.business_days nd on nd.pump_id = d.pump_id and nd.business_date = d.business_date + 1
  where l.received_next_day_l > 0
) x
group by day_id, pump_id, product;

-- Same as migration 12, except "received" comes from v_day_received (split tankers, D97).
create or replace view public.v_day_match with (security_invoker = true) as
with fuel as (
  select d.id as day_id, d.pump_id, t.product,
    bool_and(o.dip_l is not null and c.dip_l is not null) as dips_done,
    sum(o.dip_l) as opening_dip_l,
    sum(c.dip_l) as closing_dip_l
  from public.business_days d
  join public.tanks t on t.pump_id = d.pump_id and t.is_active
  left join public.tank_readings o on o.day_id = d.id and o.tank_id = t.id and o.reading_type = 'OPENING'
  left join public.tank_readings c on c.day_id = d.id and c.tank_id = t.id and c.reading_type = 'CLOSING'
  group by d.id, d.pump_id, t.product
),
totals as (
  select f.*,
    coalesce((select sum(r.received_l) from public.v_day_received r where r.day_id = f.day_id and r.product = f.product), 0) as received_l,
    coalesce((select sum(sl.meter_litres) from public.v_shift_litres sl where sl.day_id = f.day_id and sl.product = f.product), 0) as meter_l,
    coalesce((select sum(sl.test_litres) from public.v_shift_litres sl where sl.day_id = f.day_id and sl.product = f.product), 0) as test_l
  from fuel f
),
matched as (
  select t.*,
    case when t.dips_done then t.opening_dip_l + t.received_l - t.closing_dip_l end as sold_as_per_tank,
    t.meter_l - t.test_l as sold_as_per_meters
  from totals t
),
pct as (
  select m.*,
    m.sold_as_per_meters - m.sold_as_per_tank as difference,
    (m.sold_as_per_meters - m.sold_as_per_tank) * 100 / nullif(m.sold_as_per_tank, 0) as difference_pct
  from matched m
)
select
  p.day_id, p.pump_id, p.product, p.opening_dip_l, p.received_l, p.closing_dip_l, p.sold_as_per_tank,
  p.meter_l, p.test_l, p.sold_as_per_meters, p.difference, p.difference_pct,
  case when p.sold_as_per_tank is null then null
       when p.difference_pct is null then p.difference = 0
       else abs(p.difference_pct) <= (pu.rules -> 'stockDifference' ->> 'flagBeyondPercent')::numeric end as within_limit,
  coalesce(abs(p.difference_pct) > (pu.rules -> 'compliance' ->> 'basePercent')::numeric
                                   + (pu.rules -> 'compliance' -> 'evaporationPercent' ->> p.product)::numeric, false) as r1_flag
from pct p
join public.pumps pu on pu.id = p.pump_id;


-- ─── 2. Managers go back 10 days (D101) ────────────────────────────────────
update public.pumps set rules = rules || '{"managerDaysBack": 10}'::jsonb where not (rules ? 'managerDaysBack');

create or replace function public.open_day(p_pump uuid, p_date date default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := public.current_business_date(p_pump);
  v_date date := coalesce(p_date, v_today);
  v_back int;
  v_id uuid;
begin
  if not private.is_member(p_pump) then
    raise exception 'You are not a member of this pump.' using errcode = '42501';
  end if;
  if v_date > v_today then
    raise exception 'That day hasn''t started yet.' using errcode = 'P0001';
  end if;

  select d.id into v_id from public.business_days d where d.pump_id = p_pump and d.business_date = v_date;
  if v_id is null then
    select coalesce((p.rules ->> 'managerDaysBack')::int, 2) into v_back from public.pumps p where p.id = p_pump;
    if v_date < v_today - v_back and not private.is_owner(p_pump) then
      raise exception 'Only the owner can start a day older than % days.', v_back using errcode = '42501';
    end if;
    insert into public.business_days (pump_id, business_date) values (p_pump, v_date)
    on conflict (pump_id, business_date) do nothing;
    select d.id into v_id from public.business_days d where d.pump_id = p_pump and d.business_date = v_date;
  end if;

  if not private.day_id_is_locked(v_id) then
    perform private.ensure_shifts(v_id);
  end if;
  return v_id;
end;
$$;


-- ─── 3. Debit card and Credit card (D99) ───────────────────────────────────
update public.payment_types set sort_order = sort_order + 1
where kind <> 'CASH' and sort_order > (select coalesce(max(t.sort_order), 0) from public.payment_types t where t.name = 'Card' and t.pump_id = payment_types.pump_id)
  and exists (select 1 from public.payment_types t where t.name = 'Card' and t.pump_id = payment_types.pump_id);
insert into public.payment_types (pump_id, name, kind, sort_order)
select t.pump_id, 'Credit card', 'OTHER', t.sort_order + 1 from public.payment_types t
where t.name = 'Card' and not exists (select 1 from public.payment_types x where x.pump_id = t.pump_id and x.name = 'Credit card');
update public.payment_types set name = 'Debit card' where name = 'Card';


insert into public.schema_migrations_applied (name) values ('20261003120000_pilot_fixes_1');
