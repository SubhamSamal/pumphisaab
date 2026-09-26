-- ════════════════════════════════════════════════════════════════════════════
--  Migration 2 of 4 · 20260926120100_setup_tables
--
--  WHAT IT DOES
--    The pump's setup: dip charts (versioned, never edited), tanks, nozzles, shift timings,
--    fuel prices, payment types, cash notes, expense types, credit customers, staff.
--    Every table gets the standard columns, the automatic stamps, the audit trigger and
--    Row Level Security:
--      • every member of the pump can read its setup
--      • only the owner can change setup (staff: owner and managers)
--      • nobody can see another pump's rows
--
--  DATA SAFETY:  CREATES NEW THINGS ONLY.
--    No DROP · no ALTER of existing tables · no TRUNCATE · no DELETE.
--
--  HOW TO APPLY:  paste the whole file into Supabase › SQL editor › Run, after migration 1.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from public.schema_migrations_applied where name = '20260926120000_foundations') then
    raise exception 'Apply migration 1 (20260926120000_foundations) first.';
  end if;
  if exists (select 1 from public.schema_migrations_applied where name = '20260926120100_setup_tables') then
    raise exception 'Migration 20260926120100_setup_tables was already applied. Nothing was changed.';
  end if;
end $$;


-- ─── Dip charts ─────────────────────────────────────────────────────────────
-- A chart is never edited once saved. A corrected chart is a new chart with a higher
-- version, and the tank is pointed at it; old days keep using the old one.
create table public.dip_charts (
  id             uuid primary key default gen_random_uuid(),
  pump_id        uuid not null references public.pumps (id),
  name           text not null check (length(trim(name)) > 0),
  chart_version  integer not null default 1 check (chart_version > 0),
  source         text, -- e.g. the uploaded file name
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_by     uuid,
  updated_at     timestamptz not null default now(),
  version        integer not null default 1,
  unique (pump_id, name, chart_version)
);

create table public.dip_chart_rows (
  id          uuid primary key default gen_random_uuid(),
  pump_id     uuid not null references public.pumps (id),
  chart_id    uuid not null references public.dip_charts (id),
  dip_cm      numeric(6, 1) not null check (dip_cm >= 0),
  volume_l    numeric(10, 2) not null check (volume_l >= 0),
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_by  uuid,
  updated_at  timestamptz not null default now(),
  version     integer not null default 1,
  unique (chart_id, dip_cm)
);

-- ─── Tanks ──────────────────────────────────────────────────────────────────
create table public.tanks (
  id          uuid primary key default gen_random_uuid(),
  pump_id     uuid not null references public.pumps (id),
  label       text not null check (length(trim(label)) > 0), -- "HSD-1"
  product     text not null check (product in ('MS', 'HSD')),
  chart_id    uuid not null references public.dip_charts (id),
  -- Full tank = the chart's last row (e.g. 21,628.93 L), never the nominal 20 KL. Set automatically.
  capacity_l  numeric(10, 2) not null default 0,
  is_active   boolean not null default true,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_by  uuid,
  updated_at  timestamptz not null default now(),
  version     integer not null default 1,
  unique (pump_id, label)
);

-- ─── Nozzles ────────────────────────────────────────────────────────────────
create table public.nozzles (
  id          uuid primary key default gen_random_uuid(),
  pump_id     uuid not null references public.pumps (id),
  label       text not null check (length(trim(label)) > 0), -- "HSD-3"
  product     text not null check (product in ('MS', 'HSD')),
  tank_id     uuid not null references public.tanks (id),
  in_use      boolean not null default true, -- not in use: no readings needed, no flags
  sort_order  integer not null default 0,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_by  uuid,
  updated_at  timestamptz not null default now(),
  version     integer not null default 1,
  unique (pump_id, label)
);

-- ─── Shift timings ──────────────────────────────────────────────────────────
-- A change applies from its start date; past days are never recalculated.
create table public.shift_templates (
  id          uuid primary key default gen_random_uuid(),
  pump_id     uuid not null references public.pumps (id),
  starts_on   date not null,
  -- [{ "code": "A", "name": "Shift A", "start": "06:00", "end": "14:00" }, …]
  shifts      jsonb not null check (jsonb_typeof(shifts) = 'array' and jsonb_array_length(shifts) > 0),
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_by  uuid,
  updated_at  timestamptz not null default now(),
  version     integer not null default 1,
  unique (pump_id, starts_on)
);

-- ─── Fuel prices ────────────────────────────────────────────────────────────
-- Only the owner adds a price, with the date it starts from (CLAUDE.md hard rule 10).
create table public.fuel_prices (
  id          uuid primary key default gen_random_uuid(),
  pump_id     uuid not null references public.pumps (id),
  product     text not null check (product in ('MS', 'HSD')),
  per_litre   numeric(8, 2) not null check (per_litre > 0),
  starts_on   date not null,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_by  uuid,
  updated_at  timestamptz not null default now(),
  version     integer not null default 1,
  unique (pump_id, product, starts_on)
);

-- ─── Ways of getting paid ───────────────────────────────────────────────────
create table public.payment_types (
  id          uuid primary key default gen_random_uuid(),
  pump_id     uuid not null references public.pumps (id),
  name        text not null check (length(trim(name)) > 0), -- "Paytm"
  kind        text not null check (kind in ('CASH', 'CREDIT', 'OTHER')),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_by  uuid,
  updated_at  timestamptz not null default now(),
  version     integer not null default 1,
  unique (pump_id, name)
);

-- ─── Cash notes for the note count ──────────────────────────────────────────
create table public.cash_denominations (
  id          uuid primary key default gen_random_uuid(),
  pump_id     uuid not null references public.pumps (id),
  value       numeric(8, 2) not null check (value > 0), -- 500, 200, 100 …
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_by  uuid,
  updated_at  timestamptz not null default now(),
  version     integer not null default 1,
  unique (pump_id, value)
);

-- ─── Expense types ──────────────────────────────────────────────────────────
create table public.expense_categories (
  id            uuid primary key default gen_random_uuid(),
  pump_id       uuid not null references public.pumps (id),
  name          text not null check (length(trim(name)) > 0),
  default_type  text not null default 'VARIABLE' check (default_type in ('FIXED', 'VARIABLE')),
  daily_cap     numeric(12, 2) check (daily_cap is null or daily_cap >= 0), -- S9, empty = no cap
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_by    uuid,
  updated_at    timestamptz not null default now(),
  version       integer not null default 1,
  unique (pump_id, name)
);

-- ─── Credit customers and staff ─────────────────────────────────────────────
create table public.credit_customers (
  id          uuid primary key default gen_random_uuid(),
  pump_id     uuid not null references public.pumps (id),
  name        text not null check (length(trim(name)) > 0),
  is_active   boolean not null default true,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_by  uuid,
  updated_at  timestamptz not null default now(),
  version     integer not null default 1
);
create unique index credit_customers_unique_name on public.credit_customers (pump_id, lower(trim(name)));

create table public.staff (
  id          uuid primary key default gen_random_uuid(),
  pump_id     uuid not null references public.pumps (id),
  name        text not null check (length(trim(name)) > 0),
  is_active   boolean not null default true,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_by  uuid,
  updated_at  timestamptz not null default now(),
  version     integer not null default 1
);
create unique index staff_unique_name on public.staff (pump_id, lower(trim(name)));


-- ─── Chart rules enforced by the database ───────────────────────────────────
-- A saved chart can't be changed or deleted.
create function private.chart_is_fixed()
returns trigger language plpgsql
as $$
begin
  raise exception 'A saved dip chart can''t be changed. Upload a new version instead.';
end;
$$;

-- Chart rows can never be changed or deleted, and rows can't be added once a tank uses the chart.
create function private.chart_rows_are_fixed()
returns trigger language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.tanks t where t.chart_id = new.chart_id) then
      raise exception 'This dip chart is already in use by a tank. Upload a new version instead.';
    end if;
    return new;
  end if;
  raise exception 'A saved dip chart can''t be changed. Upload a new version instead.';
end;
$$;

-- Before a tank uses a chart: it must start at 0 cm = 0 L, and dip and litres must both go up
-- row by row (hard check H3 relies on this). The tank's capacity is set from the last row.
create function private.check_tank_chart()
returns trigger language plpgsql
as $$
declare
  v_rows integer;
  v_bad integer;
  v_capacity numeric;
begin
  if tg_op = 'UPDATE' and new.chart_id = old.chart_id then
    new.capacity_l := old.capacity_l;
    return new;
  end if;

  select count(*), max(volume_l) into v_rows, v_capacity from public.dip_chart_rows where chart_id = new.chart_id;
  if v_rows < 2 then
    raise exception 'The dip chart has no rows.';
  end if;
  if not exists (select 1 from public.dip_chart_rows where chart_id = new.chart_id and dip_cm = 0 and volume_l = 0) then
    raise exception 'The dip chart must start at 0 cm = 0 L.';
  end if;
  select count(*) into v_bad from (
    select volume_l <= lag(volume_l) over (order by dip_cm) as goes_down
    from public.dip_chart_rows where chart_id = new.chart_id
  ) r where r.goes_down;
  if v_bad > 0 then
    raise exception 'Litres in the dip chart must go up row by row.';
  end if;
  if exists (select 1 from public.dip_charts c where c.id = new.chart_id and c.pump_id <> new.pump_id) then
    raise exception 'That dip chart belongs to another pump.';
  end if;

  new.capacity_l := v_capacity;
  return new;
end;
$$;

-- A nozzle's fuel must match its tank's fuel, and both belong to the same pump.
create function private.check_nozzle_tank()
returns trigger language plpgsql
as $$
begin
  if not exists (select 1 from public.tanks t where t.id = new.tank_id and t.product = new.product and t.pump_id = new.pump_id) then
    raise exception 'A nozzle must be linked to a tank of the same fuel at the same pump.';
  end if;
  return new;
end;
$$;

create trigger chart_fixed before update or delete on public.dip_charts for each row execute function private.chart_is_fixed();
create trigger chart_rows_fixed before insert or update or delete on public.dip_chart_rows for each row execute function private.chart_rows_are_fixed();
create trigger check_tank_chart before insert or update on public.tanks for each row execute function private.check_tank_chart();
create trigger check_nozzle_tank before insert or update on public.nozzles for each row execute function private.check_nozzle_tank();

select private.add_standard_triggers('public.dip_charts');
select private.add_standard_triggers('public.dip_chart_rows');
select private.add_standard_triggers('public.tanks');
select private.add_standard_triggers('public.nozzles');
select private.add_standard_triggers('public.shift_templates');
select private.add_standard_triggers('public.fuel_prices');
select private.add_standard_triggers('public.payment_types');
select private.add_standard_triggers('public.cash_denominations');
select private.add_standard_triggers('public.expense_categories');
select private.add_standard_triggers('public.credit_customers');
select private.add_standard_triggers('public.staff');


-- ─── Row Level Security ─────────────────────────────────────────────────────
-- Same pattern for every setup table: members read, the owner writes.
do $$
declare
  t text;
begin
  foreach t in array array[
    'dip_charts', 'dip_chart_rows', 'tanks', 'nozzles', 'shift_templates', 'fuel_prices',
    'payment_types', 'cash_denominations', 'expense_categories', 'credit_customers', 'staff'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Members read" on public.%I for select to authenticated using (private.is_member(pump_id))', t);
    execute format('create policy "Owner adds" on public.%I for insert to authenticated with check (private.is_owner(pump_id))', t);
    execute format('create policy "Owner changes" on public.%I for update to authenticated using (private.is_owner(pump_id)) with check (private.is_owner(pump_id))', t);
    execute format('create policy "Owner removes" on public.%I for delete to authenticated using (private.is_owner(pump_id))', t);
  end loop;
end $$;

-- Staff: attendants change often, so managers can add, rename and switch staff off too (decision D38).
create policy "Managers add staff" on public.staff
  for insert to authenticated with check (private.is_member(pump_id));
create policy "Managers change staff" on public.staff
  for update to authenticated using (private.is_member(pump_id)) with check (private.is_member(pump_id));


insert into public.schema_migrations_applied (name) values ('20260926120100_setup_tables');
