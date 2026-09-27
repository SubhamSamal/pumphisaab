-- ════════════════════════════════════════════════════════════════════════════
--  Migration 5 · 20260927120000_day_opening   (Phase 4, slice 4a)
--
--  WHAT IT DOES
--    • business_days: one row per pump per business date (Not submitted / Submitted /
--      Locked), the prices the manager confirmed, "no tanker" / "no expenses".
--    • tank_readings: opening and closing dip per tank per day, litres worked out by the
--      database from the tank's chart, and the IOCL report stock (optional, D48).
--    • Day locking (D49): a submitted day locks by itself once it is 3 business days old;
--      the owner can Lock and Unlock; nobody can change anything on a locked day.
--    • App actions: open a day, confirm prices, lock, unlock (checked by the database).
--    • v_business_days (each day + whether it is locked) and v_tank_day (dips in litres,
--      the S3 and S7 checks), doing exactly what the app's maths does (hard rule 4).
--    • The audit log now also records the day's status at the time of each change.
--
--  DATA SAFETY:  ADDS NEW THINGS; CHANGES ONE VALUE; DELETES NOTHING.
--    • ALTER TABLE pumps ADD COLUMN first_business_date (new, empty column), then sets it
--      to today's business date on your pump: "submit yesterday first" starts counting
--      from the day this is pasted. No other existing row is changed.
--    • Replaces the audit function with the same one plus the day status (no data touched).
--    • No DROP · no TRUNCATE · no DELETE.
--
--  HOW TO APPLY:  paste the whole file into Supabase › SQL editor › Run, after migration 4.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from public.schema_migrations_applied where name = '20260926120300_seed_pilot_pump') then
    raise exception 'Apply migration 4 (20260926120300_seed_pilot_pump) first.';
  end if;
  if exists (select 1 from public.schema_migrations_applied where name = '20260927120000_day_opening') then
    raise exception 'Migration 20260927120000_day_opening was already applied. Nothing was changed.';
  end if;
end $$;


-- ─── 1. The pump's first day in the app ─────────────────────────────────────
-- "Submit yesterday first" only looks at days from this date on, so days typed in from
-- old notebooks never block today.
alter table public.pumps add column first_business_date date;
update public.pumps set first_business_date = public.current_business_date(id) where first_business_date is null;


-- ─── 2. Business days ───────────────────────────────────────────────────────
create table public.business_days (
  id                  uuid primary key default gen_random_uuid(),
  pump_id             uuid not null references public.pumps (id),
  business_date       date not null,
  -- DRAFT = not submitted. A SUBMITTED day also counts as locked once it is 3 business
  -- days old (see private.day_is_locked), unless the owner unlocked it.
  status              text not null default 'DRAFT' check (status in ('DRAFT', 'SUBMITTED', 'LOCKED')),
  -- The prices the manager saw and confirmed (H6). If the owner adds a new price for this
  -- date afterwards, these no longer match price_for() and the manager confirms again.
  ms_price            numeric(8, 2),
  hsd_price           numeric(8, 2),
  price_confirmed_by  uuid,
  price_confirmed_at  timestamptz,
  no_tanker           boolean not null default false,
  no_expenses         boolean not null default false,
  submitted_by        uuid,
  submitted_at        timestamptz,
  locked_by           uuid,
  locked_at           timestamptz,
  -- The owner unlocked this day: it stays open (no auto-lock) until the owner taps Lock.
  owner_opened        boolean not null default false,
  is_matched          boolean,
  created_by          uuid,
  created_at          timestamptz not null default now(),
  updated_by          uuid,
  updated_at          timestamptz not null default now(),
  version             integer not null default 1,
  unique (pump_id, business_date)
);


-- ─── 3. Tank readings (opening and closing dip) ────────────────────────────
create table public.tank_readings (
  id            uuid primary key default gen_random_uuid(),
  pump_id       uuid not null references public.pumps (id),
  day_id        uuid not null references public.business_days (id),
  tank_id       uuid not null references public.tanks (id),
  reading_type  text not null check (reading_type in ('OPENING', 'CLOSING')),
  dip_cm        numeric(6, 1) check (dip_cm >= 0),                -- H5
  -- Litres from the chart (exact, never rounded) and the chart version used. Set by the
  -- database; whatever the app sends is ignored.
  dip_l         numeric,
  chart_id      uuid references public.dip_charts (id),
  -- IOCL report stock ("Op. Stock"), opening only, optional (D48).
  book_stock_l  numeric(12, 2) check (book_stock_l >= 0),        -- H5
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_by    uuid,
  updated_at    timestamptz not null default now(),
  version       integer not null default 1,
  unique (day_id, tank_id, reading_type),
  check (reading_type = 'OPENING' or book_stock_l is null)
);
create index tank_readings_tank on public.tank_readings (tank_id, reading_type);


-- ─── 4. Is a day locked? (D49) ─────────────────────────────────────────────
-- Locked when the owner locked it, or when it was submitted and is 3 or more business
-- days old (on the morning of 05 Oct, 02 Oct and older lock). A day that was never
-- submitted never locks by itself. A day the owner unlocked stays open until locked again.
create function private.day_is_locked(p_status text, p_owner_opened boolean, p_date date, p_pump uuid)
returns boolean
language sql stable
as $$
  select p_status = 'LOCKED'
      or (p_status = 'SUBMITTED' and not p_owner_opened and p_date <= public.current_business_date(p_pump) - 3);
$$;
grant execute on function private.day_is_locked(text, boolean, date, uuid) to authenticated;

create function private.day_id_is_locked(p_day uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.day_is_locked(d.status, d.owner_opened, d.business_date, d.pump_id)
  from public.business_days d where d.id = p_day;
$$;
grant execute on function private.day_id_is_locked(uuid) to authenticated;

-- Nothing on a locked day can be added, changed or removed (added to every day table).
create function private.day_must_be_open()
returns trigger language plpgsql
as $$
declare
  v_old uuid := case when tg_op in ('UPDATE', 'DELETE') then (to_jsonb(old) ->> 'day_id')::uuid end;
  v_new uuid := case when tg_op in ('INSERT', 'UPDATE') then (to_jsonb(new) ->> 'day_id')::uuid end;
begin
  if coalesce(private.day_id_is_locked(v_old), false) or coalesce(private.day_id_is_locked(v_new), false) then
    raise exception 'This day is locked. Ask the owner to unlock it.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and v_old is distinct from v_new then
    raise exception 'A reading can''t be moved to another day.';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and not exists (
    select 1 from public.business_days d where d.id = v_new and d.pump_id = (to_jsonb(new) ->> 'pump_id')::uuid
  ) then
    raise exception 'That day belongs to another pump.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- On business_days itself: "no tanker" / "no expenses" can't change on a locked day.
-- (Status, prices, lock and unlock change only through the functions below.)
create function private.day_row_must_be_open()
returns trigger language plpgsql
as $$
begin
  if private.day_is_locked(old.status, old.owner_opened, old.business_date, old.pump_id)
     and (new.no_tanker is distinct from old.no_tanker or new.no_expenses is distinct from old.no_expenses) then
    raise exception 'This day is locked. Ask the owner to unlock it.' using errcode = 'P0001';
  end if;
  if new.business_date is distinct from old.business_date then
    raise exception 'A day''s date can''t be changed.';
  end if;
  return new;
end;
$$;
create trigger day_row_must_be_open before update on public.business_days
  for each row execute function private.day_row_must_be_open();


-- ─── 5. Dip → litres, and H3, on every save ────────────────────────────────
-- The chart is the tank's chart when the reading is first saved; later chart versions
-- never change an old day (D17). A dip outside the chart is refused (H3).
create function private.fill_dip_litres()
returns trigger language plpgsql
as $$
declare
  v_max numeric;
  v_tank_pump uuid;
begin
  select t.pump_id into v_tank_pump from public.tanks t where t.id = new.tank_id;
  if v_tank_pump is distinct from new.pump_id then
    raise exception 'That tank belongs to another pump.';
  end if;

  if tg_op = 'INSERT' or old.chart_id is null or new.tank_id is distinct from old.tank_id then
    select t.chart_id into new.chart_id from public.tanks t where t.id = new.tank_id;
  else
    new.chart_id := old.chart_id;
  end if;

  if new.dip_cm is null then
    new.dip_l := null;
    return new;
  end if;

  new.dip_l := public.dip_to_litres(new.chart_id, new.dip_cm);
  if new.dip_l is null then
    select max(r.dip_cm) into v_max from public.dip_chart_rows r where r.chart_id = new.chart_id;
    raise exception 'Dip % cm is outside the tank chart (0 to % cm). Check the reading.', new.dip_cm, v_max
      using errcode = 'P0001', hint = 'H3';
  end if;
  return new;
end;
$$;
create trigger fill_dip_litres before insert or update on public.tank_readings
  for each row execute function private.fill_dip_litres();
create trigger day_must_be_open before insert or update or delete on public.tank_readings
  for each row execute function private.day_must_be_open();

select private.add_standard_triggers('public.business_days');
select private.add_standard_triggers('public.tank_readings');


-- ─── 6. Audit log: also record the day's status at each change ─────────────
-- Same as migration 1, plus day_status_at_change for every table that belongs to a day.
create or replace function private.audit_row()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_day uuid := coalesce(v_row ->> 'day_id', case when tg_table_name = 'business_days' then v_row ->> 'id' end)::uuid;
  v_status text;
begin
  if tg_table_name = 'business_days' then
    v_status := v_row ->> 'status';
  elsif v_day is not null then
    select d.status into v_status from public.business_days d where d.id = v_day;
  end if;

  insert into public.audit_log (pump_id, table_name, record_id, action, old_values, new_values, changed_by, changed_via, day_status_at_change)
  values (
    coalesce(v_row ->> 'pump_id', case when tg_table_name = 'pumps' then v_row ->> 'id' end)::uuid,
    tg_table_name,
    (v_row ->> 'id')::uuid,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    coalesce(auth.uid(), case when tg_op <> 'DELETE' then (v_row ->> 'updated_by')::uuid end),
    coalesce(auth.jwt() ->> 'role', current_user),
    v_status
  );
  return null;
end;
$$;


-- ─── 7. Row Level Security ─────────────────────────────────────────────────
alter table public.business_days enable row level security;
alter table public.tank_readings enable row level security;

-- Days: every member reads their pump's days. Days are created only through open_day()
-- and their status and prices change only through the functions below. The app may
-- change only "no tanker" and "no expenses".
create policy "Members read" on public.business_days
  for select to authenticated using (private.is_member(pump_id));
create policy "Members change" on public.business_days
  for update to authenticated using (private.is_member(pump_id)) with check (private.is_member(pump_id));
revoke insert, update, delete on public.business_days from authenticated, anon;
grant update (no_tanker, no_expenses, version) on public.business_days to authenticated;

-- Readings: owner and managers read and write their pump's readings (locked days refused above).
create policy "Members read" on public.tank_readings
  for select to authenticated using (private.is_member(pump_id));
create policy "Members add" on public.tank_readings
  for insert to authenticated with check (private.is_member(pump_id));
create policy "Members change" on public.tank_readings
  for update to authenticated using (private.is_member(pump_id)) with check (private.is_member(pump_id));
revoke delete on public.tank_readings from authenticated, anon;


-- ─── 8. App actions ────────────────────────────────────────────────────────
-- Open a day (creates it the first time). Safe to call again and again.
--   • no dates after today's business date (server clock)
--   • a manager may start a day only for today and the 2 days before; older days that
--     already exist can be opened by anyone (if they're not locked they can be edited);
--     the owner may start any past day (e.g. an old notebook day).
create function public.open_day(p_pump uuid, p_date date default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := public.current_business_date(p_pump);
  v_date date := coalesce(p_date, v_today);
  v_id uuid;
begin
  if not private.is_member(p_pump) then
    raise exception 'You are not a member of this pump.' using errcode = '42501';
  end if;
  if v_date > v_today then
    raise exception 'That day hasn''t started yet.' using errcode = 'P0001';
  end if;

  select d.id into v_id from public.business_days d where d.pump_id = p_pump and d.business_date = v_date;
  if v_id is not null then
    return v_id;
  end if;

  if v_date < v_today - 2 and not private.is_owner(p_pump) then
    raise exception 'Only the owner can start a day older than 2 days.' using errcode = '42501';
  end if;

  insert into public.business_days (pump_id, business_date) values (p_pump, v_date)
  on conflict (pump_id, business_date) do nothing;
  select d.id into v_id from public.business_days d where d.pump_id = p_pump and d.business_date = v_date;
  return v_id;
end;
$$;

-- Confirm today's prices (H6). The prices are read by the database, never sent by the app.
create function public.confirm_prices(p_day uuid)
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

-- Owner: lock a submitted day.
create function public.lock_day(p_day uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_day public.business_days;
begin
  select * into v_day from public.business_days where id = p_day;
  if v_day.id is null or not private.is_owner(v_day.pump_id) then
    raise exception 'Only the owner can lock a day.' using errcode = '42501';
  end if;
  if v_day.status = 'DRAFT' then
    raise exception 'This day isn''t submitted yet.' using errcode = 'P0001';
  end if;
  update public.business_days
  set status = 'LOCKED', owner_opened = false, locked_by = auth.uid(), locked_at = now()
  where id = p_day;
end;
$$;

-- Owner: unlock a day (locked by the owner or by age). It stays open until locked again.
create function public.unlock_day(p_day uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_day public.business_days;
begin
  select * into v_day from public.business_days where id = p_day;
  if v_day.id is null or not private.is_owner(v_day.pump_id) then
    raise exception 'Only the owner can unlock a day.' using errcode = '42501';
  end if;
  update public.business_days
  set status = case when status = 'LOCKED' then 'SUBMITTED' else status end,
      owner_opened = true, locked_by = null, locked_at = null
  where id = p_day;
end;
$$;

revoke execute on function public.open_day(uuid, date), public.confirm_prices(uuid), public.lock_day(uuid), public.unlock_day(uuid) from public, anon;
grant execute on function public.open_day(uuid, date), public.confirm_prices(uuid), public.lock_day(uuid), public.unlock_day(uuid) to authenticated;


-- ─── 9. Views (read with the reader's own security rules) ──────────────────
-- Each day with its lock state, and whether its confirmed prices still match the owner's
-- prices for that date (if the owner added a new price, the manager must confirm again).
create view public.v_business_days with (security_invoker = true) as
select
  d.*,
  private.day_is_locked(d.status, d.owner_opened, d.business_date, d.pump_id) as is_locked,
  public.price_for(d.pump_id, 'MS', d.business_date) as ms_price_now,
  public.price_for(d.pump_id, 'HSD', d.business_date) as hsd_price_now,
  (d.price_confirmed_at is not null
    and d.ms_price is not distinct from public.price_for(d.pump_id, 'MS', d.business_date)
    and d.hsd_price is not distinct from public.price_for(d.pump_id, 'HSD', d.business_date)) as price_confirmed
from public.business_days d;

-- One row per tank per day: opening and closing dip in litres, the IOCL gap (S3) and the
-- jump from last night's closing dip (S7). Same as src/calc/checks.ts checkOpeningStock().
--   S3: gap = IOCL report stock − opening dip litres; flag when today's gap moved from
--       yesterday's gap by more than bookStockGap.flagBeyondPercentOfDip % of the opening litres.
--   S7: flag when opening dip − yesterday's closing dip is more than openingDip.flagBeyondCm.
-- "Beyond" means strictly more: exactly at the limit is still OK.
create view public.v_tank_day with (security_invoker = true) as
with readings as (
  select
    d.id as day_id, d.pump_id, d.business_date, t.id as tank_id, t.label as tank_label, t.product,
    o.dip_cm as opening_dip_cm, o.dip_l as opening_dip_l, o.book_stock_l,
    c.dip_cm as closing_dip_cm, c.dip_l as closing_dip_l
  from public.business_days d
  join public.tanks t on t.pump_id = d.pump_id
  left join public.tank_readings o on o.day_id = d.id and o.tank_id = t.id and o.reading_type = 'OPENING'
  left join public.tank_readings c on c.day_id = d.id and c.tank_id = t.id and c.reading_type = 'CLOSING'
),
with_yesterday as (
  select
    r.*,
    r.book_stock_l - r.opening_dip_l as book_gap_l,
    y.closing_dip_cm as yesterday_closing_dip_cm,
    y.book_stock_l - y.opening_dip_l as yesterday_book_gap_l
  from readings r
  left join readings y on y.pump_id = r.pump_id and y.tank_id = r.tank_id and y.business_date = r.business_date - 1
)
select
  w.*,
  w.opening_dip_cm - w.yesterday_closing_dip_cm as opening_dip_change_cm,
  w.book_gap_l - w.yesterday_book_gap_l as book_gap_moved_l,
  coalesce(abs(w.book_gap_l - w.yesterday_book_gap_l)
    > w.opening_dip_l * (p.rules -> 'bookStockGap' ->> 'flagBeyondPercentOfDip')::numeric / 100, false) as s3_flag,
  coalesce(abs(w.opening_dip_cm - w.yesterday_closing_dip_cm)
    > (p.rules -> 'openingDip' ->> 'flagBeyondCm')::numeric, false) as s7_flag
from with_yesterday w
join public.pumps p on p.id = w.pump_id;

grant select on public.v_business_days, public.v_tank_day to authenticated;
revoke select on public.v_business_days, public.v_tank_day from anon;


insert into public.schema_migrations_applied (name) values ('20260927120000_day_opening');
