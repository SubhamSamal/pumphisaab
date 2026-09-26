-- ════════════════════════════════════════════════════════════════════════════
--  Migration 3 of 4 · 20260926120200_calc_functions
--
--  WHAT IT DOES
--    The first pieces of the maths, in the database, doing exactly what the app does
--    (CLAUDE.md hard rule 4). Both are checked against the same golden cases.
--      • dip_to_litres(chart, cm)            → litres, reading straight across between chart rows
--      • business_date_at(time, start, zone) → the business date an instant belongs to
--      • current_business_date(pump)         → today's business date, from the SERVER's clock
--      • price_for(pump, fuel, date)         → the latest price that started on or before that date
--
--  DATA SAFETY:  CREATES NEW FUNCTIONS ONLY. Touches no data.
--
--  HOW TO APPLY:  paste the whole file into Supabase › SQL editor › Run, after migration 2.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from public.schema_migrations_applied where name = '20260926120100_setup_tables') then
    raise exception 'Apply migration 2 (20260926120100_setup_tables) first.';
  end if;
  if exists (select 1 from public.schema_migrations_applied where name = '20260926120200_calc_functions') then
    raise exception 'Migration 20260926120200_calc_functions was already applied. Nothing was changed.';
  end if;
end $$;


-- Dip cm → litres. Same as src/calc/dipChart.ts dipToLitres().
-- Example (pilot chart): 123 cm = 13,163.73 L, 124 cm = 13,292.84 L, so 123.4 cm = 13,215.37 L.
-- Returns nothing (null) when the dip is outside the chart: hard check H3.
create function public.dip_to_litres(p_chart uuid, p_cm numeric)
returns numeric
language sql stable
as $$
  with below as (
    select dip_cm, volume_l from public.dip_chart_rows
    where chart_id = p_chart and dip_cm <= p_cm
    order by dip_cm desc limit 1
  ),
  above as (
    select dip_cm, volume_l from public.dip_chart_rows
    where chart_id = p_chart and dip_cm >= p_cm
    order by dip_cm asc limit 1
  )
  select case
    when p_cm < 0 then null
    when b.dip_cm = a.dip_cm then b.volume_l
    else b.volume_l + (a.volume_l - b.volume_l) * (p_cm - b.dip_cm) / (a.dip_cm - b.dip_cm)
  end
  from below b cross join above a;
$$;


-- The business date an instant belongs to. Same as src/lib/businessDay.ts businessDateAt().
-- A business day runs from the day start (e.g. 06:00) to the same time next day, so Shift C
-- entries made at 02:00 belong to the previous calendar date.
create function public.business_date_at(p_at timestamptz, p_day_start time, p_time_zone text)
returns date
language sql immutable
as $$
  select ((p_at at time zone p_time_zone) - p_day_start)::date;
$$;


-- Today's business date for a pump, from the server's clock (a phone's clock is never trusted).
create function public.current_business_date(p_pump uuid)
returns date
language sql stable
as $$
  select public.business_date_at(now(), p.day_start_time, p.time_zone)
  from public.pumps p where p.id = p_pump;
$$;


-- The price of a fuel for a business date. Same as src/calc/prices.ts priceFor().
-- A price starting 01 Oct applies to 01 Oct and later, never to 30 Sep.
create function public.price_for(p_pump uuid, p_product text, p_date date)
returns numeric
language sql stable
as $$
  select per_litre from public.fuel_prices
  where pump_id = p_pump and product = p_product and starts_on <= p_date
  order by starts_on desc limit 1;
$$;


insert into public.schema_migrations_applied (name) values ('20260926120200_calc_functions');
