-- ════════════════════════════════════════════════════════════════════════════
--  Migration 7 · 20260927140000_tanker   (Phase 4, slice 4c)
--
--  WHAT IT DOES
--    • tanker_receipts: one per tanker (the IOCL challan): tanker number, invoice number and
--      date, and the business day it was unloaded on.
--    • receipt_lines: one per fuel on the tanker: litres ordered, litres short, price and
--      margin per litre (prefilled from the last tanker by the app), and the optional dips
--      just before and after unloading (litres worked out from the tank's chart; H3).
--    • v_receipt_lines, v_tanker_totals, v_day_received: received = ordered − short (D23),
--      invoice amount, short amount, to pay, margin, dip rise and the S6 checks, doing
--      exactly what src/calc/tanker.ts and checkTanker() do (hard rule 4).
--
--  DATA SAFETY:  CREATES NEW THINGS ONLY.
--    No DROP · no ALTER of existing tables · no TRUNCATE · no DELETE.
--
--  HOW TO APPLY:  paste the whole file into Supabase › SQL editor › Run, after migration 6.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from public.schema_migrations_applied where name = '20260927130000_shift_meters') then
    raise exception 'Apply migration 6 (20260927130000_shift_meters) first.';
  end if;
  if exists (select 1 from public.schema_migrations_applied where name = '20260927140000_tanker') then
    raise exception 'Migration 20260927140000_tanker was already applied. Nothing was changed.';
  end if;
end $$;


-- ─── 1. Tanker receipts ────────────────────────────────────────────────────
create table public.tanker_receipts (
  id            uuid primary key default gen_random_uuid(),   -- made on the phone, so a retry never adds it twice
  pump_id       uuid not null references public.pumps (id),
  day_id        uuid not null references public.business_days (id),   -- the day it was unloaded
  vehicle_no    text not null check (vehicle_no ~ '^[A-Z0-9]{4,12}$'),  -- OD02CD9087
  invoice_no    text check (invoice_no is null or length(trim(invoice_no)) > 0),
  invoice_date  date,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_by    uuid,
  updated_at    timestamptz not null default now(),
  version       integer not null default 1
);
create index tanker_receipts_day on public.tanker_receipts (day_id);


-- ─── 2. One line per fuel on the tanker ────────────────────────────────────
create table public.receipt_lines (
  id              uuid primary key default gen_random_uuid(),
  pump_id         uuid not null references public.pumps (id),
  day_id          uuid not null references public.business_days (id),
  receipt_id      uuid not null references public.tanker_receipts (id) on delete cascade,
  product         text not null check (product in ('MS', 'HSD')),
  tank_id         uuid not null references public.tanks (id),
  ordered_l       numeric(10, 2) not null check (ordered_l > 0),                       -- H5
  short_l         numeric(10, 2) not null default 0 check (short_l >= 0),              -- H5
  price_per_l     numeric(8, 2) check (price_per_l >= 0),
  margin_per_l    numeric(8, 2) check (margin_per_l >= 0),
  -- Optional check: dips just before and after unloading. Litres from the tank's chart, set by
  -- the database (the app's litres are ignored), with the chart version used.
  dip_before_cm   numeric(6, 1) check (dip_before_cm >= 0),
  dip_after_cm    numeric(6, 1) check (dip_after_cm >= 0),
  dip_before_l    numeric,
  dip_after_l     numeric,
  chart_id        uuid references public.dip_charts (id),
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_by      uuid,
  updated_at      timestamptz not null default now(),
  version         integer not null default 1,
  unique (receipt_id, tank_id),
  check (short_l <= ordered_l)
);
create index receipt_lines_product on public.receipt_lines (pump_id, product, created_at desc);


-- ─── 3. Checks on every save ───────────────────────────────────────────────
create function private.check_receipt()
returns trigger language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.day_id is distinct from old.day_id then
    raise exception 'A tanker can''t be moved to another day. Remove it and add it on the right day.';
  end if;
  return new;
end;
$$;

-- The line's tank must hold the line's fuel at the same pump, and belong to the receipt's day.
-- Dips → litres from the tank's chart, and H3 (outside the chart) refused.
create function private.check_receipt_line()
returns trigger language plpgsql
as $$
declare
  v_max numeric;
begin
  if not exists (select 1 from public.tanker_receipts r where r.id = new.receipt_id and r.day_id = new.day_id and r.pump_id = new.pump_id) then
    raise exception 'That tanker belongs to another day or pump.';
  end if;
  if not exists (select 1 from public.tanks t where t.id = new.tank_id and t.pump_id = new.pump_id and t.product = new.product) then
    raise exception 'A tanker line must go into a tank of the same fuel at the same pump.';
  end if;

  if tg_op = 'INSERT' or old.chart_id is null or new.tank_id is distinct from old.tank_id then
    select t.chart_id into new.chart_id from public.tanks t where t.id = new.tank_id;
  else
    new.chart_id := old.chart_id;
  end if;
  new.dip_before_l := case when new.dip_before_cm is not null then public.dip_to_litres(new.chart_id, new.dip_before_cm) end;
  new.dip_after_l := case when new.dip_after_cm is not null then public.dip_to_litres(new.chart_id, new.dip_after_cm) end;
  if (new.dip_before_cm is not null and new.dip_before_l is null) or (new.dip_after_cm is not null and new.dip_after_l is null) then
    select max(r.dip_cm) into v_max from public.dip_chart_rows r where r.chart_id = new.chart_id;
    raise exception 'Dip is outside the tank chart (0 to % cm). Check the reading.', v_max using errcode = 'P0001', hint = 'H3';
  end if;
  return new;
end;
$$;

create trigger check_receipt before update on public.tanker_receipts for each row execute function private.check_receipt();
create trigger check_receipt_line before insert or update on public.receipt_lines for each row execute function private.check_receipt_line();
create trigger day_must_be_open before insert or update or delete on public.tanker_receipts for each row execute function private.day_must_be_open();
create trigger day_must_be_open before insert or update or delete on public.receipt_lines for each row execute function private.day_must_be_open();

select private.add_standard_triggers('public.tanker_receipts');
select private.add_standard_triggers('public.receipt_lines');


-- ─── 4. Row Level Security: owner and managers add, fix and remove tankers ──
do $$
declare
  t text;
begin
  foreach t in array array['tanker_receipts', 'receipt_lines'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Members read" on public.%I for select to authenticated using (private.is_member(pump_id))', t);
    execute format('create policy "Members add" on public.%I for insert to authenticated with check (private.is_member(pump_id))', t);
    execute format('create policy "Members change" on public.%I for update to authenticated using (private.is_member(pump_id)) with check (private.is_member(pump_id))', t);
    execute format('create policy "Members remove" on public.%I for delete to authenticated using (private.is_member(pump_id))', t);
  end loop;
end $$;


-- ─── 5. Views: the same maths as src/calc/tanker.ts and checkTanker() (S6) ──
--   received  = ordered − short                       (D23: the short is taken off)
--   amount    = ordered × price,  short amount = short × price,  margin = received × margin
--   dip rise  = litres after − litres before           (only when both dips are typed)
--   S6 short  : short is beyond tanker.shortFlagBeyondPercent % of ordered
--   S6 dip    : (dip rise − received) is beyond tanker.dipCheckFlagBeyondPercent % of received
create view public.v_receipt_lines with (security_invoker = true) as
select
  l.id, l.pump_id, l.day_id, l.receipt_id, l.product, l.tank_id,
  l.ordered_l, l.short_l, l.price_per_l, l.margin_per_l, l.dip_before_cm, l.dip_after_cm,
  l.ordered_l - l.short_l as received_l,
  l.ordered_l * l.price_per_l as amount,
  l.short_l * l.price_per_l as short_amount,
  (l.ordered_l - l.short_l) * l.margin_per_l as margin,
  l.dip_after_l - l.dip_before_l as dip_rise_l,
  l.short_l * 100 / l.ordered_l > (p.rules -> 'tanker' ->> 'shortFlagBeyondPercent')::numeric as s6_short,
  coalesce(abs((l.dip_after_l - l.dip_before_l) - (l.ordered_l - l.short_l)) * 100 / nullif(l.ordered_l - l.short_l, 0)
    > (p.rules -> 'tanker' ->> 'dipCheckFlagBeyondPercent')::numeric, false) as s6_dip
from public.receipt_lines l
join public.pumps p on p.id = l.pump_id;

-- Per tanker: totals are known only when every line has a price (and a margin, for the margin).
create view public.v_tanker_totals with (security_invoker = true) as
select
  r.id as receipt_id, r.pump_id, r.day_id, r.vehicle_no,
  case when bool_and(l.price_per_l is not null) then sum(l.amount) end as total_amount,
  case when bool_and(l.price_per_l is not null) then sum(l.short_amount) end as total_short_amount,
  case when bool_and(l.price_per_l is not null) then sum(l.amount) - sum(l.short_amount) end as to_pay,
  case when bool_and(l.margin_per_l is not null) then sum(l.margin) end as total_margin
from public.tanker_receipts r
join public.v_receipt_lines l on l.receipt_id = r.id
group by r.id, r.pump_id, r.day_id, r.vehicle_no;

-- Litres received into the tanks on a business day, per fuel (feeds "sold as per tank").
create view public.v_day_received with (security_invoker = true) as
select day_id, pump_id, product, sum(ordered_l - short_l) as received_l
from public.receipt_lines
group by day_id, pump_id, product;

grant select on public.v_receipt_lines, public.v_tanker_totals, public.v_day_received to authenticated;
revoke select on public.v_receipt_lines, public.v_tanker_totals, public.v_day_received from anon;


insert into public.schema_migrations_applied (name) values ('20260927140000_tanker');
