-- ════════════════════════════════════════════════════════════════════════════
--  Migration 12 · 20260929130000_closing_and_submit   (Phase 4, slice 4f)
--
--  WHAT IT DOES
--    • v_day_match (hard rule 4): per day and fuel, sold as per tank (opening dip + tanker −
--      closing dip) vs sold as per meters, the Difference in litres and %, and whether it is
--      within the limit (S1) and within IOCL's allowed variation (R1). Same as src/calc/tank.ts.
--    • v_shift_match (hard rule 4): per shift, Should have / Received / Difference and whether
--      it is within the limit (S2). Built on v_shift_money.
--    • day_sections(day): which of the 8 Today sections are done (H4), the same way Today does.
--    • submit_day(day): the only way to submit. Re-checks the whole day on the server (locked,
--      yesterday first, price confirmed H6, every section done H4, H2 / H8 / H9), then marks the
--      day Submitted and stores whether it matched. Safe to tap twice; "Submit again" after a
--      change updates the result (the first submit time is kept, the latest is stored too).
--    • business_days: two new columns for the latest submit (who and when).
--    • Fix: the pump's first day no longer copies openings from days before it that were only
--      browsed (empty shifts made by opening an old date).
--
--  DATA SAFETY:  ADDS NEW THINGS; DELETES NOTHING.
--    • ALTER TABLE business_days ADD COLUMN last_submitted_by, last_submitted_at (new, empty).
--    • New views v_day_match, v_shift_match; new functions day_sections, day_is_matched, submit_day.
--    • Replaces private.previous_closing (same inputs and outputs; see 1b).
--    • No DROP · no TRUNCATE · no DELETE. No existing row is changed.
--
--  HOW TO APPLY:  paste the whole file into Supabase › SQL editor › Run, after migration 11.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from public.schema_migrations_applied where name = '20260929120000_expenses') then
    raise exception 'Apply migration 11 (20260929120000_expenses) first.';
  end if;
  if exists (select 1 from public.schema_migrations_applied where name = '20260929130000_closing_and_submit') then
    raise exception 'Migration 20260929130000_closing_and_submit was already applied. Nothing was changed.';
  end if;
end $$;


-- ─── 1. Latest submit ──────────────────────────────────────────────────────
alter table public.business_days add column last_submitted_by uuid;
alter table public.business_days add column last_submitted_at timestamptz;


-- ─── 1b. The shift before, for copying openings (fix) ───────────────────────
-- Just browsing to a date before the pump's first day in the app creates that day's (empty)
-- shifts, and the first day's Shift A then "copied" from them ("last night's shift has no closing
-- yet", owner's 4b check). A day on or after the first day now looks back only to days on or
-- after the first day; old notebook days before it still chain among themselves.
create or replace function private.previous_closing(p_shift uuid, p_nozzle uuid, out has_previous boolean, out closing numeric)
language sql stable security definer set search_path = ''
as $$
  with this as (
    select s.pump_id, s.starts_at, d.business_date, p.first_business_date
    from public.shifts s
    join public.business_days d on d.id = s.day_id
    join public.pumps p on p.id = s.pump_id
    where s.id = p_shift
  ),
  prev as (
    select s.id from public.shifts s
    join public.business_days d on d.id = s.day_id, this
    where s.pump_id = this.pump_id and s.starts_at < this.starts_at
      and (this.first_business_date is null or this.business_date < this.first_business_date or d.business_date >= this.first_business_date)
    order by s.starts_at desc limit 1
  )
  select (select count(*) > 0 from prev),
         (select r.closing from public.nozzle_readings r where r.shift_id = (select id from prev) and r.nozzle_id = p_nozzle);
$$;


-- ─── 2. The fuel check per day: same maths as src/calc/tank.ts ─────────────
--   Sold as per tank   = opening dip L + tanker L received (ordered − short) − closing dip L
--   Sold as per meters = Σ shifts (meter litres − test litres)
--   Difference         = sold as per meters − sold as per tank   (negative = possible loss)
--   Difference %       = Difference × 100 ÷ sold as per tank (none when nothing left the tank)
--   Within the limit   = |%| ≤ stockDifference.flagBeyondPercent (no %: only a zero Difference)
--   R1                 = |%| > compliance.basePercent + evaporation for that fuel
-- Sold as per tank is empty until every in-use tank of that fuel has both dips.
create view public.v_day_match with (security_invoker = true) as
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
    coalesce((select sum(l.received_l) from public.v_receipt_lines l where l.day_id = f.day_id and l.product = f.product), 0) as received_l,
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


-- ─── 3. The money check per shift (named as in hard rule 4) ────────────────
create view public.v_shift_match with (security_invoker = true) as
select m.shift_id, m.day_id, m.pump_id, m.shift_code, m.should_have, m.received, m.difference,
       case when m.difference is null then null else not m.s2_flag end as within_limit
from public.v_shift_money m;

grant select on public.v_day_match, public.v_shift_match to authenticated;
revoke select on public.v_day_match, public.v_shift_match from anon;


-- ─── 4. The 8 sections (H4): same rules as Today (src/features/day/model.ts) ─
--   Opening dip / Closing dip: every in-use tank has its dip.
--   Tanker: a tanker was added, or "No tanker came today" was answered.
--   Shift A/B/C: every in-use nozzle has an opening and a closing (not below it), and someone
--                is ticked as working.
--   Sales: every shift's sales are marked Done.
--   Expenses: an expense was added, or "No expenses today" was tapped.
create function public.day_sections(p_day uuid)
returns table (section text, title text, done boolean, sort_order int)
language sql stable security invoker set search_path = ''
as $$
  with d as (select * from public.business_days where id = p_day),
  dips as (
    select r.type,
      not exists (select 1 from public.tanks t, d
                  where t.pump_id = d.pump_id and t.is_active
                    and not exists (select 1 from public.tank_readings tr
                                    where tr.day_id = d.id and tr.tank_id = t.id and tr.reading_type = r.type and tr.dip_cm is not null)) as done
    from (values ('OPENING'), ('CLOSING')) r(type)
  ),
  shift_done as (
    select c.code, c.n,
      exists (select 1 from public.shifts s where s.day_id = p_day and s.shift_code = c.code)
      and not exists (
        select 1 from public.nozzles n, d, public.shifts s
        where n.pump_id = d.pump_id and n.in_use and s.day_id = p_day and s.shift_code = c.code
          and not exists (select 1 from public.nozzle_readings r
                          where r.shift_id = s.id and r.nozzle_id = n.id
                            and r.opening is not null and r.closing is not null and r.closing >= r.opening))
      and exists (select 1 from public.shift_attendants a join public.shifts s on s.id = a.shift_id
                  where s.day_id = p_day and s.shift_code = c.code) as done
    from (values ('A', 3), ('B', 4), ('C', 5)) c(code, n)
  )
  select 'openingDip', 'Opening dip', (select done from dips where type = 'OPENING'), 1
  union all
  select 'tanker', 'Tanker', (select d.no_tanker from d) or exists (select 1 from public.tanker_receipts tr where tr.day_id = p_day), 2
  union all
  select 'shift' || code, 'Shift ' || code || ' readings', done, n from shift_done
  union all
  select 'sales', 'Sales',
    (select count(*) = 3 and bool_and(s.sales_done_at is not null) from public.shifts s where s.day_id = p_day), 6
  union all
  select 'expenses', 'Expenses', (select d.no_expenses from d) or exists (select 1 from public.expenses e where e.day_id = p_day), 7
  union all
  select 'closingDip', 'Closing dip', (select done from dips where type = 'CLOSING'), 8;
$$;


-- ─── 5. Matched: every fuel and every shift worked out and within the limits ─
-- (same as src/calc/day.ts isMatched; submit_day has already refused any hard error)
create function public.day_is_matched(p_day uuid)
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select exists (select 1 from public.v_day_match m where m.day_id = p_day)
     and not exists (select 1 from public.v_day_match m where m.day_id = p_day and m.within_limit is not true)
     and exists (select 1 from public.v_shift_match m where m.day_id = p_day)
     and not exists (select 1 from public.v_shift_match m where m.day_id = p_day and m.within_limit is not true);
$$;


-- ─── 6. Submit ─────────────────────────────────────────────────────────────
create function public.submit_day(p_day uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_day public.v_business_days;
  v_first date;
  v_missing text;
  v_problem record;
  v_problems int;
  v_matched boolean;
begin
  select * into v_day from public.v_business_days where id = p_day;
  if v_day.id is null or not private.is_member(v_day.pump_id) then
    raise exception 'That day belongs to another pump.' using errcode = '42501';
  end if;
  if v_day.is_locked then
    raise exception 'This day is locked. Ask the owner to unlock it.' using errcode = 'P0001';
  end if;

  -- Yesterday first (D3): every earlier day from the pump's first day in the app is submitted.
  select p.first_business_date into v_first from public.pumps p where p.id = v_day.pump_id;
  if v_first is not null and v_day.business_date > v_first then
    select to_char(g.dt, 'DD Mon') into v_missing
    from generate_series(v_first, v_day.business_date - 1, interval '1 day') g(dt)
    where not exists (select 1 from public.business_days b
                      where b.pump_id = v_day.pump_id and b.business_date = g.dt::date and b.status <> 'DRAFT')
    order by g.dt
    limit 1;
    if v_missing is not null then
      raise exception 'Submit % first. Days are submitted in order.', v_missing using errcode = 'P0001', hint = 'D3';
    end if;
  end if;

  if not v_day.price_confirmed then
    raise exception 'Confirm today''s price on Today first.' using errcode = 'P0001', hint = 'H6';
  end if;

  select string_agg(s.title, ', ' order by s.sort_order) into v_missing from public.day_sections(p_day) s where not s.done;
  if v_missing is not null then
    raise exception 'Finish these first: %.', v_missing using errcode = 'P0001', hint = 'H4';
  end if;

  select count(*) into v_problems from public.day_problems(p_day);
  if v_problems > 0 then
    select * into v_problem from public.day_problems(p_day) limit 1;
    raise exception '%', v_problem.message || case when v_problems > 1 then ' (and ' || (v_problems - 1) || ' more to fix)' else '' end
      using errcode = 'P0001', hint = v_problem.code;
  end if;

  v_matched := public.day_is_matched(p_day);

  update public.business_days
  set status = 'SUBMITTED',
      is_matched = v_matched,
      submitted_by = coalesce(submitted_by, auth.uid()),
      submitted_at = coalesce(submitted_at, now()),
      last_submitted_by = auth.uid(),
      last_submitted_at = now()
  where id = p_day;

  return jsonb_build_object('is_matched', v_matched, 'submitted_at', now());
end;
$$;

revoke execute on function public.submit_day(uuid), public.day_sections(uuid), public.day_is_matched(uuid) from public, anon;
grant execute on function public.submit_day(uuid), public.day_sections(uuid), public.day_is_matched(uuid) to authenticated;


insert into public.schema_migrations_applied (name) values ('20260929130000_closing_and_submit');
