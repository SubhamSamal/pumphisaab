-- ════════════════════════════════════════════════════════════════════════════
--  Migration 16 · 20261020120000_price_requests   (Phase 5a Part 1, owner, 20 Oct 2026)
--
--  WHAT IT DOES
--    • A manager who sees a different price at the machine taps "Price is different" and types
--      it (D119, hard rule 10 changed by the owner). It's saved as a request for that day and fuel,
--      starting on that day. It is used only after the owner taps Approve; "Keep old price" says no.
--    • While a request waits, the day's price is not confirmed: managers keep typing, but the money
--      check and Submit wait (D120). confirm_prices() refuses until the owner answers.
--    • When the owner taps "Price is different" the price is added at once (no waiting).
--    • Approving adds an ordinary fuel price row (with the margin in force), so the existing rule
--      "a new price for a day asks the manager to confirm again" does the rest.
--
--  DATA SAFETY:  ADDS ONLY; DELETES NOTHING.
--    • CREATE TABLE price_requests (new, empty) with the standard columns, Row Level Security and
--      the audit trigger. CREATE two functions; REPLACE confirm_prices() with the same checks plus
--      "no request waiting". No existing row is changed.
--    • No DROP · no TRUNCATE · no DELETE · no ALTER of existing tables.
--
--  HOW TO APPLY:  paste the whole file into Supabase › SQL editor › Run, after migration 15.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from public.schema_migrations_applied where name = '20261010120000_phonepe_and_bank_deposit') then
    raise exception 'Apply migration 15 (20261010120000_phonepe_and_bank_deposit) first.';
  end if;
  if exists (select 1 from public.schema_migrations_applied where name = '20261020120000_price_requests') then
    raise exception 'Migration 20261020120000_price_requests was already applied. Nothing was changed.';
  end if;
end $$;


-- ─── 1. Price requests ─────────────────────────────────────────────────────
create table public.price_requests (
  id            uuid primary key default gen_random_uuid(),
  pump_id       uuid not null references public.pumps (id),
  day_id        uuid not null references public.business_days (id),
  product       text not null check (product in ('MS', 'HSD')),
  per_litre     numeric(8, 2) not null check (per_litre > 0 and per_litre < 1000),
  starts_on     date not null,
  status        text not null default 'WAITING' check (status in ('WAITING', 'APPROVED', 'KEPT')),
  answered_by   uuid,
  answered_at   timestamptz,
  fuel_price_id uuid references public.fuel_prices (id),
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_by    uuid,
  updated_at    timestamptz not null default now(),
  version       integer not null default 1
);
-- One waiting request per day and fuel (a second one replaces the first).
create unique index price_requests_one_waiting on public.price_requests (day_id, product) where status = 'WAITING';
create index price_requests_pump_status on public.price_requests (pump_id, status);

select private.add_standard_triggers('public.price_requests');

-- Everyone at the pump reads them; they are written only through the two functions below.
alter table public.price_requests enable row level security;
create policy "Members read" on public.price_requests
  for select to authenticated using (private.is_member(pump_id));
revoke insert, update, delete on public.price_requests from authenticated, anon;


-- ─── 2. Owner's answer ─────────────────────────────────────────────────────
-- Approve: the price is added from its start date with the margin in force for that fuel.
-- Keep old price: the request is closed and nothing else changes.
create function public.answer_price_request(p_request uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_req public.price_requests;
  v_margin numeric;
  v_price uuid;
begin
  select * into v_req from public.price_requests where id = p_request;
  if v_req.id is null or not private.is_member(v_req.pump_id) then
    raise exception 'Price request not found.' using errcode = '42501';
  end if;
  if not private.is_owner(v_req.pump_id) then
    raise exception 'Only the owner can approve a price.' using errcode = '42501';
  end if;
  if v_req.status <> 'WAITING' then
    raise exception 'This price was already answered.' using errcode = 'P0001';
  end if;

  if p_approve then
    select f.margin_per_l into v_margin from public.fuel_prices f
    where f.pump_id = v_req.pump_id and f.product = v_req.product and f.starts_on <= v_req.starts_on
    order by f.starts_on desc limit 1;

    insert into public.fuel_prices (pump_id, product, per_litre, starts_on, margin_per_l)
    values (v_req.pump_id, v_req.product, v_req.per_litre, v_req.starts_on, v_margin)
    on conflict (pump_id, product, starts_on) do update set per_litre = excluded.per_litre
    returning id into v_price;
  end if;

  update public.price_requests
  set status = case when p_approve then 'APPROVED' else 'KEPT' end,
      answered_by = auth.uid(), answered_at = now(), fuel_price_id = v_price
  where id = p_request;
end;
$$;


-- ─── 3. "Price is different" ───────────────────────────────────────────────
-- From a manager: a waiting request (a second one for the same day and fuel replaces the first),
-- and the day's price is no longer confirmed. From the owner: approved at once.
create function public.request_price(p_day uuid, p_product text, p_per_litre numeric)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_day public.business_days;
  v_id uuid;
begin
  select * into v_day from public.business_days where id = p_day;
  if v_day.id is null or not private.is_member(v_day.pump_id) then
    raise exception 'Day not found.' using errcode = '42501';
  end if;
  if private.day_is_locked(v_day.status, v_day.owner_opened, v_day.business_date, v_day.pump_id) then
    raise exception 'This day is locked. Ask the owner to unlock it.' using errcode = 'P0001';
  end if;
  if v_day.status <> 'DRAFT' then
    raise exception 'This day is already submitted. Ask the owner to change the price.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.tanks t where t.pump_id = v_day.pump_id and t.product = p_product and t.is_active) then
    raise exception 'This pump has no % tank.', p_product using errcode = 'P0001';
  end if;
  if p_per_litre is null or p_per_litre <= 0 or p_per_litre >= 1000 or p_per_litre <> round(p_per_litre, 2) then
    raise exception 'Type the price per litre, like 110.07.' using errcode = 'P0001';
  end if;

  update public.price_requests set per_litre = p_per_litre
  where day_id = p_day and product = p_product and status = 'WAITING'
  returning id into v_id;
  if v_id is null then
    insert into public.price_requests (pump_id, day_id, product, per_litre, starts_on)
    values (v_day.pump_id, p_day, p_product, p_per_litre, v_day.business_date)
    returning id into v_id;
  end if;

  if private.is_owner(v_day.pump_id) then
    perform public.answer_price_request(v_id, true);
  else
    update public.business_days set price_confirmed_by = null, price_confirmed_at = null where id = p_day;
  end if;
  return v_id;
end;
$$;


-- ─── 4. Confirm waits for the owner's answer (D120) ────────────────────────
-- Same as migration 5 (20260927120000_day_opening), plus: refused while a price waits.
create or replace function public.confirm_prices(p_day uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_day public.business_days;
  v_fuel text;
  v_ms numeric;
  v_hsd numeric;
begin
  select * into v_day from public.business_days where id = p_day;
  if v_day.id is null or not private.is_member(v_day.pump_id) then
    raise exception 'Day not found.' using errcode = '42501';
  end if;
  if private.day_is_locked(v_day.status, v_day.owner_opened, v_day.business_date, v_day.pump_id) then
    raise exception 'This day is locked. Ask the owner to unlock it.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.price_requests r where r.day_id = p_day and r.status = 'WAITING') then
    raise exception 'A new price is waiting for the owner''s OK.' using errcode = 'P0001', hint = 'H6';
  end if;

  v_ms := public.price_for(v_day.pump_id, 'MS', v_day.business_date);
  v_hsd := public.price_for(v_day.pump_id, 'HSD', v_day.business_date);
  for v_fuel in select distinct t.product from public.tanks t where t.pump_id = v_day.pump_id and t.is_active loop
    if (v_fuel = 'MS' and v_ms is null) or (v_fuel = 'HSD' and v_hsd is null) then
      raise exception 'No % price is set for %. Ask the owner to add it.', v_fuel, to_char(v_day.business_date, 'DD Mon YYYY')
        using errcode = 'P0001';
    end if;
  end loop;

  update public.business_days
  set ms_price = v_ms, hsd_price = v_hsd, price_confirmed_by = auth.uid(), price_confirmed_at = now()
  where id = p_day;
end;
$$;

revoke execute on function public.request_price(uuid, text, numeric), public.answer_price_request(uuid, boolean) from public, anon;
grant execute on function public.request_price(uuid, text, numeric), public.answer_price_request(uuid, boolean) to authenticated;


insert into public.schema_migrations_applied (name) values ('20261020120000_price_requests');
