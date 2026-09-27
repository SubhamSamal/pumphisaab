-- ════════════════════════════════════════════════════════════════════════════
--  Migration 6 · 20260927130000_shift_meters   (Phase 4, slice 4b)
--
--  WHAT IT DOES
--    • shifts: Shift A, B, C of each day, with their start and end times from the pump's
--      shift timings (Shift C belongs to the day it started). Made automatically when a day
--      is opened.
--    • shift_attendants: who worked each shift (from Profile › Staff).
--    • nozzle_readings: opening and closing meter per nozzle per shift. The opening is copied
--      by the database from the previous shift's closing. A different opening (meter replaced
--      or repaired) waits for the owner's approval (H2). Closing below opening is refused (H1).
--    • nozzle_tests: testing (nozzle + litres), taken off the sale.
--    • approve_meter_change() for the owner; day_problems() lists what blocks a day (H2, H8
--      for now; more with each slice); v_nozzle_readings and v_shift_litres do the same maths
--      as the app (hard rule 4).
--
--  DATA SAFETY:  ADDS NEW THINGS; DELETES NOTHING.
--    • Replaces the function open_day() with the same one that also makes the day's shifts.
--    • No DROP · no ALTER of existing tables · no TRUNCATE · no DELETE.
--
--  HOW TO APPLY:  paste the whole file into Supabase › SQL editor › Run, after migration 5.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from public.schema_migrations_applied where name = '20260927120000_day_opening') then
    raise exception 'Apply migration 5 (20260927120000_day_opening) first.';
  end if;
  if exists (select 1 from public.schema_migrations_applied where name = '20260927130000_shift_meters') then
    raise exception 'Migration 20260927130000_shift_meters was already applied. Nothing was changed.';
  end if;
end $$;


-- ─── 1. Shifts ─────────────────────────────────────────────────────────────
create table public.shifts (
  id             uuid primary key default gen_random_uuid(),
  pump_id        uuid not null references public.pumps (id),
  day_id         uuid not null references public.business_days (id),
  shift_code     text not null check (length(trim(shift_code)) > 0),   -- "A"
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  -- Cash already in the drawer when the shift started (D24, D46) and "Sales done" (slice 4d).
  opening_cash   numeric(12, 2) check (opening_cash >= 0),
  sales_done_at  timestamptz,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_by     uuid,
  updated_at     timestamptz not null default now(),
  version        integer not null default 1,
  unique (day_id, shift_code),
  check (ends_at > starts_at)
);
create index shifts_pump_start on public.shifts (pump_id, starts_at);

-- Makes the day's shifts from the shift timings in force on that date (a timing change
-- applies from its start date; past days keep theirs). Safe to run again.
create function private.ensure_shifts(p_day uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_day public.business_days;
  v_zone text;
  v_shifts jsonb;
  v_s jsonb;
  v_start timestamptz;
  v_end timestamptz;
begin
  select * into v_day from public.business_days where id = p_day;
  select p.time_zone into v_zone from public.pumps p where p.id = v_day.pump_id;
  select t.shifts into v_shifts from public.shift_templates t
  where t.pump_id = v_day.pump_id and t.starts_on <= v_day.business_date
  order by t.starts_on desc limit 1;
  if v_shifts is null then
    return;
  end if;
  for v_s in select * from jsonb_array_elements(v_shifts) loop
    v_start := (v_day.business_date + (v_s ->> 'start')::time) at time zone v_zone;
    v_end := (v_day.business_date + (v_s ->> 'end')::time) at time zone v_zone;
    if v_end <= v_start then
      v_end := v_end + interval '1 day';   -- Shift C ends the next morning
    end if;
    insert into public.shifts (pump_id, day_id, shift_code, starts_at, ends_at)
    values (v_day.pump_id, v_day.id, v_s ->> 'code', v_start, v_end)
    on conflict (day_id, shift_code) do nothing;
  end loop;
end;
$$;


-- ─── 2. Who worked the shift ───────────────────────────────────────────────
create table public.shift_attendants (
  id          uuid primary key default gen_random_uuid(),
  pump_id     uuid not null references public.pumps (id),
  day_id      uuid not null references public.business_days (id),
  shift_id    uuid not null references public.shifts (id),
  staff_id    uuid not null references public.staff (id),
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_by  uuid,
  updated_at  timestamptz not null default now(),
  version     integer not null default 1,
  unique (shift_id, staff_id)
);


-- ─── 3. Meter readings ─────────────────────────────────────────────────────
create table public.nozzle_readings (
  id                   uuid primary key default gen_random_uuid(),
  pump_id              uuid not null references public.pumps (id),
  day_id               uuid not null references public.business_days (id),
  shift_id             uuid not null references public.shifts (id),
  nozzle_id            uuid not null references public.nozzles (id),
  -- Copied from the previous shift's closing, unless the manager typed it (opening_typed):
  -- a meter change, or the very first reading when there's no earlier closing.
  opening              numeric(12, 2) check (opening >= 0),          -- H5
  opening_typed        boolean not null default false,
  closing              numeric(12, 2) check (closing >= 0),          -- H5
  -- H2: NONE = opening is the last closing (or nothing to compare), PENDING = waiting for the
  -- owner, APPROVED = the owner approved the meter change. Set by the database only.
  meter_change_status  text not null default 'NONE' check (meter_change_status in ('NONE', 'PENDING', 'APPROVED')),
  approved_by          uuid,
  approved_at          timestamptz,
  created_by           uuid,
  created_at           timestamptz not null default now(),
  updated_by           uuid,
  updated_at           timestamptz not null default now(),
  version              integer not null default 1,
  unique (shift_id, nozzle_id),
  -- H1: closing can't be less than opening.
  constraint closing_not_below_opening check (closing is null or opening is null or closing >= opening)
);
create index nozzle_readings_nozzle on public.nozzle_readings (nozzle_id);


-- ─── 4. Testing ────────────────────────────────────────────────────────────
create table public.nozzle_tests (
  id          uuid primary key default gen_random_uuid(),
  pump_id     uuid not null references public.pumps (id),
  day_id      uuid not null references public.business_days (id),
  shift_id    uuid not null references public.shifts (id),
  nozzle_id   uuid not null references public.nozzles (id),
  litres      numeric(8, 2) not null check (litres > 0),                -- H5
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_by  uuid,
  updated_at  timestamptz not null default now(),
  version     integer not null default 1
);
create index nozzle_tests_shift on public.nozzle_tests (shift_id);


-- ─── 5. The previous closing of a nozzle ──────────────────────────────────
-- The shift just before this one (by start time, across days), and that shift's closing for
-- the nozzle. has_previous = false means this is the first shift ever: nothing to copy.
create function private.previous_closing(p_shift uuid, p_nozzle uuid, out has_previous boolean, out closing numeric)
language sql stable security definer set search_path = ''
as $$
  with this as (select pump_id, starts_at from public.shifts where id = p_shift),
  prev as (
    select s.id from public.shifts s, this
    where s.pump_id = this.pump_id and s.starts_at < this.starts_at
    order by s.starts_at desc limit 1
  )
  select (select count(*) > 0 from prev),
         (select r.closing from public.nozzle_readings r where r.shift_id = (select id from prev) and r.nozzle_id = p_nozzle);
$$;
grant execute on function private.previous_closing(uuid, uuid) to authenticated;


-- ─── 6. Checks on every save ───────────────────────────────────────────────
-- Shift, nozzle and day must all belong together and to the same pump.
create function private.check_shift_row()
returns trigger language plpgsql
as $$
begin
  if not exists (select 1 from public.shifts s where s.id = new.shift_id and s.day_id = new.day_id and s.pump_id = new.pump_id) then
    raise exception 'That shift belongs to another day or pump.';
  end if;
  if tg_table_name in ('nozzle_readings', 'nozzle_tests')
     and not exists (select 1 from public.nozzles n where n.id = (to_jsonb(new) ->> 'nozzle_id')::uuid and n.pump_id = new.pump_id) then
    raise exception 'That nozzle belongs to another pump.';
  end if;
  if tg_table_name = 'shift_attendants'
     and not exists (select 1 from public.staff st where st.id = (to_jsonb(new) ->> 'staff_id')::uuid and st.pump_id = new.pump_id) then
    raise exception 'That person belongs to another pump.';
  end if;
  return new;
end;
$$;

-- Opening from the previous closing, and the meter-change state (H2). Runs on every save of a
-- reading, and again whenever the previous shift's closing changes.
create function private.fill_opening()
returns trigger language plpgsql
as $$
declare
  v_prev record;
begin
  if tg_op = 'UPDATE' and (new.shift_id is distinct from old.shift_id or new.nozzle_id is distinct from old.nozzle_id) then
    raise exception 'A reading can''t be moved to another shift or nozzle.';
  end if;
  select * into v_prev from private.previous_closing(new.shift_id, new.nozzle_id);

  -- The owner's approval (only approve_meter_change() can set this column).
  if tg_op = 'UPDATE' and new.meter_change_status = 'APPROVED' and old.meter_change_status = 'PENDING'
     and new.opening is not distinct from old.opening then
    return new;
  end if;

  if not new.opening_typed then
    new.opening := v_prev.closing;
    new.meter_change_status := 'NONE';
  elsif v_prev.closing is null then
    new.meter_change_status := 'NONE';                        -- nothing to compare it with
  elsif new.opening = v_prev.closing then
    new.opening_typed := false;                               -- same as the last closing after all
    new.meter_change_status := 'NONE';
  elsif tg_op = 'UPDATE' and old.meter_change_status = 'APPROVED' and new.opening = old.opening then
    new.meter_change_status := 'APPROVED';                    -- already approved, unchanged
  else
    new.meter_change_status := 'PENDING';                     -- H2: waits for the owner
  end if;

  if new.meter_change_status <> 'APPROVED' then
    new.approved_by := null;
    new.approved_at := null;
  end if;
  return new;
end;
$$;

-- When a closing changes, the next shift's opening follows (if it was copied), or its
-- meter-change state is worked out again (if it was typed).
create function private.next_opening_follows()
returns trigger language plpgsql
as $$
declare
  v_next uuid;
begin
  if tg_op = 'UPDATE' and new.closing is not distinct from old.closing then
    return null;
  end if;
  select r.id into v_next
  from public.shifts this
  join public.shifts s on s.pump_id = this.pump_id and s.starts_at > this.starts_at
  join public.nozzle_readings r on r.shift_id = s.id and r.nozzle_id = new.nozzle_id
  where this.id = new.shift_id
    and s.starts_at = (select min(s2.starts_at) from public.shifts s2 where s2.pump_id = this.pump_id and s2.starts_at > this.starts_at);
  if v_next is not null then
    update public.nozzle_readings set opening = opening where id = v_next;   -- re-runs fill_opening
  end if;
  return null;
end;
$$;

create trigger check_shift_row before insert or update on public.shift_attendants for each row execute function private.check_shift_row();
create trigger check_shift_row before insert or update on public.nozzle_readings for each row execute function private.check_shift_row();
create trigger check_shift_row before insert or update on public.nozzle_tests for each row execute function private.check_shift_row();
create trigger fill_opening before insert or update on public.nozzle_readings for each row execute function private.fill_opening();
create trigger next_opening_follows after insert or update on public.nozzle_readings for each row execute function private.next_opening_follows();

create trigger day_must_be_open before insert or update or delete on public.shifts for each row execute function private.day_must_be_open();
create trigger day_must_be_open before insert or update or delete on public.shift_attendants for each row execute function private.day_must_be_open();
create trigger day_must_be_open before insert or update or delete on public.nozzle_readings for each row execute function private.day_must_be_open();
create trigger day_must_be_open before insert or update or delete on public.nozzle_tests for each row execute function private.day_must_be_open();

select private.add_standard_triggers('public.shifts');
select private.add_standard_triggers('public.shift_attendants');
select private.add_standard_triggers('public.nozzle_readings');
select private.add_standard_triggers('public.nozzle_tests');


-- ─── 7. Row Level Security ─────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['shifts', 'shift_attendants', 'nozzle_readings', 'nozzle_tests'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Members read" on public.%I for select to authenticated using (private.is_member(pump_id))', t);
    execute format('create policy "Members add" on public.%I for insert to authenticated with check (private.is_member(pump_id))', t);
    execute format('create policy "Members change" on public.%I for update to authenticated using (private.is_member(pump_id)) with check (private.is_member(pump_id))', t);
    execute format('create policy "Members remove" on public.%I for delete to authenticated using (private.is_member(pump_id))', t);
  end loop;
end $$;

-- Shifts are made only by the database (with the day). Their cash columns open in slice 4d.
revoke insert, update, delete on public.shifts from authenticated, anon;
-- Readings: the app may type opening (meter change / first reading) and closing, never the
-- approval. Readings aren't deleted: an emptied box is saved as empty.
revoke update, delete on public.nozzle_readings from authenticated, anon;
-- (The app saves with "insert or update", which re-sends the row's keys; the triggers stop
-- them from actually changing.)
grant update (pump_id, day_id, shift_id, nozzle_id, opening, opening_typed, closing, version) on public.nozzle_readings to authenticated;
revoke update on public.shift_attendants from authenticated, anon;


-- ─── 8. Opening a day also makes its shifts ────────────────────────────────
create or replace function public.open_day(p_pump uuid, p_date date default null)
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
  if v_id is null then
    if v_date < v_today - 2 and not private.is_owner(p_pump) then
      raise exception 'Only the owner can start a day older than 2 days.' using errcode = '42501';
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


-- ─── 9. The owner approves a meter change (H2) ──────────────────────────────
create function public.approve_meter_change(p_reading uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_r public.nozzle_readings;
begin
  select * into v_r from public.nozzle_readings where id = p_reading;
  if v_r.id is null or not private.is_owner(v_r.pump_id) then
    raise exception 'Only the owner can approve a meter change.' using errcode = '42501';
  end if;
  if v_r.meter_change_status <> 'PENDING' then
    raise exception 'There is no meter change waiting on this reading.' using errcode = 'P0001';
  end if;
  update public.nozzle_readings
  set meter_change_status = 'APPROVED', approved_by = auth.uid(), approved_at = now()
  where id = p_reading;
end;
$$;
revoke execute on function public.approve_meter_change(uuid) from public, anon;
grant execute on function public.approve_meter_change(uuid) to authenticated;


-- ─── 10. Views: the same maths as src/calc/meters.ts ───────────────────────
-- One row per shift per in-use nozzle, with or without a saved reading, and the previous
-- closing (the app shows it and the engine uses it for H2).
create view public.v_nozzle_readings with (security_invoker = true) as
select
  s.day_id, s.pump_id, s.id as shift_id, s.shift_code, s.starts_at,
  n.id as nozzle_id, n.label as nozzle_label, n.product, n.tank_id, n.sort_order,
  r.id as reading_id, r.version, r.opening, r.opening_typed, r.closing, r.meter_change_status,
  p.has_previous, p.closing as previous_closing,
  case when r.closing >= r.opening then r.closing - r.opening end as sale_l
from public.shifts s
join public.nozzles n on n.pump_id = s.pump_id and n.in_use
left join public.nozzle_readings r on r.shift_id = s.id and r.nozzle_id = n.id
cross join lateral private.previous_closing(s.id, n.id) p;

-- Litres per shift per fuel. Sold as per meters = meter sale of in-use nozzles − testing.
create view public.v_shift_litres with (security_invoker = true) as
select
  s.day_id, s.pump_id, s.id as shift_id, s.shift_code, f.product,
  coalesce((select sum(r.closing - r.opening) from public.nozzle_readings r join public.nozzles n on n.id = r.nozzle_id
            where r.shift_id = s.id and n.product = f.product and n.in_use and r.closing >= r.opening), 0) as meter_litres,
  coalesce((select sum(t.litres) from public.nozzle_tests t join public.nozzles n on n.id = t.nozzle_id
            where t.shift_id = s.id and n.product = f.product), 0) as test_litres
from public.shifts s
cross join (values ('MS'), ('HSD')) f(product);

grant select on public.v_nozzle_readings, public.v_shift_litres to authenticated;
revoke select on public.v_nozzle_readings, public.v_shift_litres from anon;


-- ─── 11. What blocks a day (grows with each slice; Submit uses it in 4f) ────
--   H2  a meter change waiting for the owner
--   H8  more litres tested on a nozzle than it sold in the shift
create function public.day_problems(p_day uuid)
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
  where n.in_use and r.closing >= r.opening and t.tested > r.closing - r.opening;
$$;
grant execute on function public.day_problems(uuid) to authenticated;


insert into public.schema_migrations_applied (name) values ('20260927130000_shift_meters');
