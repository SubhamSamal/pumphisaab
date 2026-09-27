-- ════════════════════════════════════════════════════════════════════════════
--  Migration 10 · 20260928120000_margin_and_chamber_dips   (Phase 4, tanker fixes, owner's check)
--
--  WHAT IT DOES
--    • fuel_prices.margin_per_l: the dealer margin per litre, set by the owner with the price
--      (owner, 27 Sep: "Manager confirms price and Owner can set Margin"). A tanker's invoice
--      price per litre = today's selling price − this margin.
--    • receipt_chambers.dip_before_cm: every chamber gets its own dip before, because diesel can
--      be sold between two chambers to make room (owner, 27 Sep). Litres worked out from the chart.
--    • Views: a chamber's rise = its own dip after − its own dip before; a tanker's rise with
--      chambers = the chambers' rises added up (feeds the S6 dip check). Same as src/calc/tanker.ts.
--
--  DATA SAFETY:  ADDS NEW THINGS; DELETES NOTHING.
--    • ALTER TABLE fuel_prices ADD COLUMN margin_per_l (new, empty column; no row changed).
--    • ALTER TABLE receipt_chambers ADD COLUMN dip_before_cm, dip_before_l (new, empty columns;
--      chambers already saved keep working: an empty "before" means the previous chamber's "after").
--    • Replaces one function (the chamber check) and three views with the same columns (plus
--      dip_before_cm at the end of v_receipt_chambers). No DROP · no TRUNCATE · no DELETE.
--
--  HOW TO APPLY:  paste the whole file into Supabase › SQL editor › Run, after migration 9.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from public.schema_migrations_applied where name = '20260927160000_tanker_chambers') then
    raise exception 'Apply migration 9 (20260927160000_tanker_chambers) first.';
  end if;
  if exists (select 1 from public.schema_migrations_applied where name = '20260928120000_margin_and_chamber_dips') then
    raise exception 'Migration 20260928120000_margin_and_chamber_dips was already applied. Nothing was changed.';
  end if;
end $$;


-- ─── 1. Margin with the price (owner only, like the price) ─────────────────
alter table public.fuel_prices add column margin_per_l numeric(8, 2) check (margin_per_l >= 0);


-- ─── 2. Dip before, per chamber ────────────────────────────────────────────
alter table public.receipt_chambers add column dip_before_cm numeric(6, 1) check (dip_before_cm >= 0);
alter table public.receipt_chambers add column dip_before_l numeric;

create or replace function private.check_receipt_chamber()
returns trigger language plpgsql
as $$
declare
  v_chart uuid;
  v_max numeric;
begin
  select l.chart_id into v_chart from public.receipt_lines l
  where l.id = new.receipt_line_id and l.day_id = new.day_id and l.pump_id = new.pump_id;
  if not found then
    raise exception 'That tanker line belongs to another day or pump.';
  end if;
  new.dip_after_l := public.dip_to_litres(v_chart, new.dip_after_cm);
  new.dip_before_l := case when new.dip_before_cm is not null then public.dip_to_litres(v_chart, new.dip_before_cm) end;
  if new.dip_after_l is null or (new.dip_before_cm is not null and new.dip_before_l is null) then
    select max(r.dip_cm) into v_max from public.dip_chart_rows r where r.chart_id = v_chart;
    raise exception 'Dip is outside the tank chart (0 to % cm). Check the reading.', v_max using errcode = 'P0001', hint = 'H3';
  end if;
  return new;
end;
$$;


-- ─── 3. Views ──────────────────────────────────────────────────────────────
-- Per chamber: rise = its dip after − its dip before (if not typed: the previous chamber's
-- after, or the line's dip before unloading); short = chamber litres − rise.
create or replace view public.v_receipt_chambers with (security_invoker = true) as
select
  c.id, c.pump_id, c.day_id, c.receipt_line_id, l.receipt_id, l.product, c.chamber_no, c.litres, c.dip_after_cm,
  c.dip_after_l - coalesce(c.dip_before_l, lag(c.dip_after_l) over w, l.dip_before_l) as rise_l,
  c.litres - (c.dip_after_l - coalesce(c.dip_before_l, lag(c.dip_after_l) over w, l.dip_before_l)) as short_l,
  c.dip_before_cm
from public.receipt_chambers c
join public.receipt_lines l on l.id = c.receipt_line_id
window w as (partition by c.receipt_line_id order by c.chamber_no);

-- The tanker line's rise: with chambers, their rises added up (only when every chamber's rise is
-- known); without, dip after − dip before. S6 compares it with litres received.
create or replace view public.v_receipt_lines with (security_invoker = true) as
with rise as (
  select l.id,
    case
      when exists (select 1 from public.receipt_chambers c where c.receipt_line_id = l.id) then
        (select case when bool_and(vc.rise_l is not null) then sum(vc.rise_l) end from public.v_receipt_chambers vc where vc.receipt_line_id = l.id)
      else l.dip_after_l - l.dip_before_l
    end as dip_rise_l
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
    > (p.rules -> 'tanker' ->> 'dipCheckFlagBeyondPercent')::numeric, false) as s6_dip
from public.receipt_lines l
join rise r on r.id = l.id
join public.pumps p on p.id = l.pump_id;


insert into public.schema_migrations_applied (name) values ('20260928120000_margin_and_chamber_dips');
