-- ════════════════════════════════════════════════════════════════════════════
--  Migration 17 · 20261021120000_nozzle_checks_and_attendants   (Phase 5a Part 2, owner, 20-21 Oct 2026)
--
--  WHAT IT DOES
--    • Nozzle test, "The 5 L measure got" (D110): each test can also hold the litres the measure
--      actually got. The nozzle's error = measure − meter, and as % of the meter. Beyond the pump's
--      limit (rules.testing.measureFlagBeyondPercent, IOCL ±25 mL per 5 L = 0.5%) it is flag S10.
--      Positive = the nozzle gives more than it counts (the pump loses); negative = customers get less.
--      Same maths as src/calc (checks.ts, S10): view v_nozzle_checks.
--    • Who was on which nozzle (D115, D121): each shift, each nozzle can get the attendant who worked
--      it. Stored as its own list (shift, nozzle, person, optional handover reading) so later several
--      people can share a nozzle in a shift, each with their reading, without a rebuild. The person
--      must be ticked on that shift; unticking them takes them off their nozzles too.
--
--  DATA SAFETY:  ADDS ONLY; DELETES NOTHING.
--    • ALTER TABLE nozzle_tests ADD COLUMN measured_l (new, empty; old tests stay as they are).
--    • CREATE TABLE nozzle_attendants (new, empty) with the standard columns, Row Level Security and
--      the audit trigger. CREATE VIEW v_nozzle_checks. REPLACE private.check_shift_row() (same checks,
--      now also for the new table).
--    • UPDATE pumps: adds "measureFlagBeyondPercent": "0.5" under rules.testing (nothing else changes).
--    • No DROP · no TRUNCATE · no DELETE of any existing row.
--
--  HOW TO APPLY:  paste the whole file into Supabase › SQL editor › Run, after migration 16.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from public.schema_migrations_applied where name = '20261020120000_price_requests') then
    raise exception 'Apply migration 16 (20261020120000_price_requests) first.';
  end if;
  if exists (select 1 from public.schema_migrations_applied where name = '20261021120000_nozzle_checks_and_attendants') then
    raise exception 'Migration 20261021120000_nozzle_checks_and_attendants was already applied. Nothing was changed.';
  end if;
end $$;


-- ─── 1. "The 5 L measure got" ─────────────────────────────────────────────
alter table public.nozzle_tests add column measured_l numeric(8, 2) check (measured_l >= 0);   -- H5

-- The limit lives with the pump's other rules (same as src/calc/rules.ts).
update public.pumps
set rules = rules || jsonb_build_object('testing', coalesce(rules -> 'testing', '{}'::jsonb) || '{"measureFlagBeyondPercent": "0.5"}'::jsonb)
where not coalesce(rules -> 'testing' ? 'measureFlagBeyondPercent', false);

-- One row per test that has a measure: the nozzle's error and S10. Same as checks.ts (S10).
create view public.v_nozzle_checks with (security_invoker = true) as
select
  t.id as test_id, t.pump_id, t.day_id, t.shift_id, s.shift_code, d.business_date,
  t.nozzle_id, n.label as nozzle_label, n.product,
  t.litres as meter_l, t.measured_l,
  t.measured_l - t.litres as error_l,
  (t.measured_l - t.litres) * 100 / t.litres as error_pct,
  abs((t.measured_l - t.litres) * 100 / t.litres)
    > coalesce((pu.rules -> 'testing' ->> 'measureFlagBeyondPercent')::numeric, 0.5) as s10_flag
from public.nozzle_tests t
join public.shifts s on s.id = t.shift_id
join public.business_days d on d.id = t.day_id
join public.nozzles n on n.id = t.nozzle_id
join public.pumps pu on pu.id = t.pump_id
where t.measured_l is not null;

grant select on public.v_nozzle_checks to authenticated;
revoke select on public.v_nozzle_checks from anon;


-- ─── 2. Who was on which nozzle ────────────────────────────────────────────
create table public.nozzle_attendants (
  id                uuid primary key default gen_random_uuid(),
  pump_id           uuid not null references public.pumps (id),
  day_id            uuid not null references public.business_days (id),
  shift_id          uuid not null references public.shifts (id),
  nozzle_id         uuid not null references public.nozzles (id),
  staff_id          uuid not null references public.staff (id),
  -- Later (several people on one nozzle): the meter when this person handed over. Empty for now.
  handover_reading  numeric(12, 2) check (handover_reading >= 0),
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_by        uuid,
  updated_at        timestamptz not null default now(),
  version           integer not null default 1,
  unique (shift_id, nozzle_id, staff_id)
);
create index nozzle_attendants_day on public.nozzle_attendants (day_id);

-- Same checks as the other shift tables (migration 6), now also for nozzle_attendants.
create or replace function private.check_shift_row()
returns trigger language plpgsql
as $$
begin
  if not exists (select 1 from public.shifts s where s.id = new.shift_id and s.day_id = new.day_id and s.pump_id = new.pump_id) then
    raise exception 'That shift belongs to another day or pump.';
  end if;
  if tg_table_name in ('nozzle_readings', 'nozzle_tests', 'nozzle_attendants')
     and not exists (select 1 from public.nozzles n where n.id = (to_jsonb(new) ->> 'nozzle_id')::uuid and n.pump_id = new.pump_id) then
    raise exception 'That nozzle belongs to another pump.';
  end if;
  if tg_table_name in ('shift_attendants', 'nozzle_attendants')
     and not exists (select 1 from public.staff st where st.id = (to_jsonb(new) ->> 'staff_id')::uuid and st.pump_id = new.pump_id) then
    raise exception 'That person belongs to another pump.';
  end if;
  return new;
end;
$$;

-- The person must be ticked on that shift.
create function private.nozzle_person_on_shift()
returns trigger language plpgsql
as $$
begin
  if not exists (select 1 from public.shift_attendants a where a.shift_id = new.shift_id and a.staff_id = new.staff_id) then
    raise exception 'Tick this person on the shift first.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Unticking someone from a shift takes them off that shift's nozzles too.
create function private.drop_nozzle_people()
returns trigger language plpgsql
as $$
begin
  delete from public.nozzle_attendants where shift_id = old.shift_id and staff_id = old.staff_id;
  return old;
end;
$$;

create trigger check_shift_row before insert or update on public.nozzle_attendants for each row execute function private.check_shift_row();
create trigger day_must_be_open before insert or update or delete on public.nozzle_attendants for each row execute function private.day_must_be_open();
create trigger nozzle_person_on_shift before insert or update on public.nozzle_attendants for each row execute function private.nozzle_person_on_shift();
create trigger drop_nozzle_people before delete on public.shift_attendants for each row execute function private.drop_nozzle_people();
select private.add_standard_triggers('public.nozzle_attendants');

alter table public.nozzle_attendants enable row level security;
create policy "Members read" on public.nozzle_attendants for select to authenticated using (private.is_member(pump_id));
create policy "Members add" on public.nozzle_attendants for insert to authenticated with check (private.is_member(pump_id));
create policy "Members change" on public.nozzle_attendants for update to authenticated using (private.is_member(pump_id)) with check (private.is_member(pump_id));
create policy "Members remove" on public.nozzle_attendants for delete to authenticated using (private.is_member(pump_id));


insert into public.schema_migrations_applied (name) values ('20261021120000_nozzle_checks_and_attendants');
