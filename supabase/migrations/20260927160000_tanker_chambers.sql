-- ════════════════════════════════════════════════════════════════════════════
--  Migration 9 · 20260927160000_tanker_chambers   (Phase 4, slice 4c fixes from the owner's check)
--
--  WHAT IT DOES
--    • tanker_receipts.invoice_amount: the challan's total, typed (owner, 27 Sep). To pay is now
--      invoice amount − short amount.
--    • receipt_chambers: chamber-by-chamber unloading (owner: this is mandatory at the pump).
--      For each chamber: its litres from the challan and our tank's dip after it is emptied
--      (litres from the tank's chart; H3). The first chamber starts from the line's "dip before".
--    • v_receipt_chambers: how much the tank went up per chamber and that chamber's short,
--      the same maths as src/calc/tanker.ts (hard rule 4). v_tanker_totals gains the invoice amount.
--
--  DATA SAFETY:  ADDS NEW THINGS; DELETES NOTHING.
--    • ALTER TABLE tanker_receipts ADD COLUMN invoice_amount (new, empty column; no row changed).
--    • Replaces the view v_tanker_totals (same columns, plus invoice_amount at the end).
--    • No DROP · no TRUNCATE · no DELETE.
--
--  HOW TO APPLY:  paste the whole file into Supabase › SQL editor › Run, after migration 8.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from public.schema_migrations_applied where name = '20260927150000_sales') then
    raise exception 'Apply migration 8 (20260927150000_sales) first.';
  end if;
  if exists (select 1 from public.schema_migrations_applied where name = '20260927160000_tanker_chambers') then
    raise exception 'Migration 20260927160000_tanker_chambers was already applied. Nothing was changed.';
  end if;
end $$;


-- ─── 1. The challan's total ────────────────────────────────────────────────
alter table public.tanker_receipts add column invoice_amount numeric(14, 2) check (invoice_amount >= 0);


-- ─── 2. Chamber by chamber ─────────────────────────────────────────────────
create table public.receipt_chambers (
  id               uuid primary key default gen_random_uuid(),
  pump_id          uuid not null references public.pumps (id),
  day_id           uuid not null references public.business_days (id),
  receipt_line_id  uuid not null references public.receipt_lines (id) on delete cascade,
  chamber_no       smallint not null check (chamber_no between 1 and 12),
  litres           numeric(10, 2) not null check (litres > 0),           -- H5
  dip_after_cm     numeric(6, 1) not null check (dip_after_cm >= 0),     -- H5
  dip_after_l      numeric,                                              -- set by the database
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_by       uuid,
  updated_at       timestamptz not null default now(),
  version          integer not null default 1,
  unique (receipt_line_id, chamber_no)
);

-- Same day and pump as its tanker line; dip → litres on the line's chart (the tank's chart
-- when the line was saved); a dip outside the chart is refused (H3).
create function private.check_receipt_chamber()
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
  if new.dip_after_l is null then
    select max(r.dip_cm) into v_max from public.dip_chart_rows r where r.chart_id = v_chart;
    raise exception 'Dip % cm is outside the tank chart (0 to % cm). Check the reading.', new.dip_after_cm, v_max
      using errcode = 'P0001', hint = 'H3';
  end if;
  return new;
end;
$$;

create trigger check_receipt_chamber before insert or update on public.receipt_chambers for each row execute function private.check_receipt_chamber();
create trigger day_must_be_open before insert or update or delete on public.receipt_chambers for each row execute function private.day_must_be_open();
select private.add_standard_triggers('public.receipt_chambers');

alter table public.receipt_chambers enable row level security;
create policy "Members read" on public.receipt_chambers for select to authenticated using (private.is_member(pump_id));
create policy "Members add" on public.receipt_chambers for insert to authenticated with check (private.is_member(pump_id));
create policy "Members change" on public.receipt_chambers for update to authenticated using (private.is_member(pump_id)) with check (private.is_member(pump_id));
create policy "Members remove" on public.receipt_chambers for delete to authenticated using (private.is_member(pump_id));


-- ─── 3. Views ──────────────────────────────────────────────────────────────
-- Per chamber: rise = litres after this chamber − litres before it (the previous chamber's
-- "after", or the line's dip before unloading); short = chamber litres − rise.
create view public.v_receipt_chambers with (security_invoker = true) as
select
  c.id, c.pump_id, c.day_id, c.receipt_line_id, l.receipt_id, l.product, c.chamber_no, c.litres, c.dip_after_cm,
  c.dip_after_l - coalesce(lag(c.dip_after_l) over w, l.dip_before_l) as rise_l,
  c.litres - (c.dip_after_l - coalesce(lag(c.dip_after_l) over w, l.dip_before_l)) as short_l
from public.receipt_chambers c
join public.receipt_lines l on l.id = c.receipt_line_id
window w as (partition by c.receipt_line_id order by c.chamber_no);

-- Tanker totals: To pay = invoice amount (typed from the challan; else worked out) − short amount.
create or replace view public.v_tanker_totals with (security_invoker = true) as
select
  r.id as receipt_id, r.pump_id, r.day_id, r.vehicle_no,
  case when bool_and(l.price_per_l is not null) then sum(l.amount) end as total_amount,
  case when bool_and(l.price_per_l is not null) then sum(l.short_amount) end as total_short_amount,
  case when bool_and(l.price_per_l is not null) then coalesce(r.invoice_amount, sum(l.amount)) - sum(l.short_amount) end as to_pay,
  case when bool_and(l.margin_per_l is not null) then sum(l.margin) end as total_margin,
  r.invoice_amount
from public.tanker_receipts r
join public.v_receipt_lines l on l.receipt_id = r.id
group by r.id, r.pump_id, r.day_id, r.vehicle_no, r.invoice_amount;

grant select on public.v_receipt_chambers to authenticated;
revoke select on public.v_receipt_chambers from anon;


insert into public.schema_migrations_applied (name) values ('20260927160000_tanker_chambers');
