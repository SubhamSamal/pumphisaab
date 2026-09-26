-- ════════════════════════════════════════════════════════════════════════════
--  Migration 1 of 4 · 20260926120000_foundations
--
--  WHAT IT DOES
--    • A change log of which migrations have been applied (schema_migrations_applied)
--    • The audit log: every insert, update and delete on every table, who and when
--    • Two automatic stamps on every row: who created/changed it and when, plus a
--      row version so two people can't silently overwrite each other
--    • Pumps and pump members (which login belongs to which pump, Owner or Manager)
--    • Security helpers used by Row Level Security: "am I a member / the owner of this pump?"
--
--  DATA SAFETY:  CREATES NEW THINGS ONLY.
--    No DROP · no ALTER of existing tables · no TRUNCATE · no DELETE.
--    Safe on an empty project. Stops with a clear message if it was already applied.
--
--  HOW TO APPLY:  Supabase › SQL editor › New query › paste this whole file › Run.
--                 Apply migrations in number order (1, 2, 3, 4).
-- ════════════════════════════════════════════════════════════════════════════

-- Stop early if this file was already applied (nothing is changed in that case).
do $$
begin
  if to_regclass('public.schema_migrations_applied') is not null then
    raise exception 'Migration 20260926120000_foundations was already applied. Nothing was changed.';
  end if;
end $$;

-- Functions the app must not call directly live in their own schema.
create schema if not exists private;
grant usage on schema private to authenticated;


-- ─── 1. Change log of applied migrations ─────────────────────────────────────
-- Every migration ends by writing its own name here, so we can check the live
-- database has exactly the migrations the repo has, in order.
create table public.schema_migrations_applied (
  name        text primary key,
  applied_at  timestamptz not null default now()
);
alter table public.schema_migrations_applied enable row level security;
-- No policies: the app can't read or change it. Only the SQL editor can.


-- ─── 2. Pumps ───────────────────────────────────────────────────────────────
create table public.pumps (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(trim(name)) > 0),
  omc             text not null default 'IOCL' check (omc in ('IOCL', 'BPCL', 'HPCL', 'OTHER')),
  address         text,
  -- The business day starts at this time (local time), e.g. 06:00. See src/lib/businessDay.ts.
  day_start_time  time not null default '06:00',
  time_zone       text not null default 'Asia/Kolkata',
  -- Every limit ("when to flag"). Same shape as src/calc/rules.ts.
  rules           jsonb not null check (jsonb_typeof(rules) = 'object'),
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_by      uuid,
  updated_at      timestamptz not null default now(),
  version         integer not null default 1
);


-- ─── 3. Pump members: which login belongs to which pump ─────────────────────
create table public.pump_members (
  id          uuid primary key default gen_random_uuid(),
  pump_id     uuid not null references public.pumps (id),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- Lower-case letters, numbers, dot and underscore; 3 to 30 characters. Same rule as src/lib/username.ts.
  username    text not null unique check (username ~ '^[a-z0-9][a-z0-9._]{2,29}$'),
  full_name   text not null check (length(trim(full_name)) > 0),
  role        text not null check (role in ('OWNER', 'MANAGER')),
  is_active   boolean not null default true,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_by  uuid,
  updated_at  timestamptz not null default now(),
  version     integer not null default 1,
  unique (pump_id, user_id)
);


-- ─── 4. Security helpers ───────────────────────────────────────────────────
-- "Am I an active member of this pump?" Runs with owner rights so it can look at
-- pump_members without tripping over pump_members' own security rules.
create function private.is_member(p_pump uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.pump_members m
    where m.pump_id = p_pump and m.user_id = (select auth.uid()) and m.is_active
  );
$$;

-- "Am I the active owner of this pump?"
create function private.is_owner(p_pump uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.pump_members m
    where m.pump_id = p_pump and m.user_id = (select auth.uid()) and m.is_active and m.role = 'OWNER'
  );
$$;

grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.is_owner(uuid) to authenticated;


-- ─── 5. Audit log ───────────────────────────────────────────────────────────
-- Filled only by the audit trigger below. Nobody can edit or delete it, not even the owner.
create table public.audit_log (
  id                    uuid primary key default gen_random_uuid(),
  -- Running number: the exact order changes happened in, even within the same moment.
  seq                   bigint generated always as identity,
  pump_id               uuid references public.pumps (id),
  table_name            text not null,
  record_id             uuid,
  action                text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_values            jsonb,
  new_values            jsonb,
  changed_by            uuid,          -- the logged-in person; empty for SQL editor changes
  changed_via           text not null, -- 'authenticated', 'service_role' or the database role (e.g. 'postgres')
  -- The exact clock time, so several changes saved together still read in the order they happened.
  changed_at            timestamptz not null default clock_timestamp(),
  day_status_at_change  text           -- filled from Phase 4, when business days exist
);
create index audit_log_pump_seq on public.audit_log (pump_id, seq desc);
create index audit_log_record on public.audit_log (table_name, record_id);
alter table public.audit_log enable row level security;

-- The owner can read their pump's history. Nobody can insert, change or delete through the app.
create policy "Owner reads the pump's audit log" on public.audit_log
  for select to authenticated using (private.is_owner(pump_id));

-- History can't be changed or deleted by anyone (this also stops the SQL editor).
create function private.audit_log_is_read_only()
returns trigger language plpgsql
as $$
begin
  raise exception 'The audit log can''t be changed or deleted.';
end;
$$;
create trigger audit_log_read_only
  before update or delete on public.audit_log
  for each row execute function private.audit_log_is_read_only();


-- ─── 6. Automatic stamps on every row ───────────────────────────────────────
-- On insert: who created it and when (the app can't fake these), version 1.
-- On update: who changed it and when, and version + 1.
--   If the app sends a version that isn't the current one, someone else changed the row
--   first: the update is refused with a plain message instead of silently overwriting.
-- A row can never move to another pump, and its creation stamp can't be changed.
create function private.stamp_row()
returns trigger language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_at := new.created_at;
    new.updated_by := new.created_by;
    new.version := 1;
    return new;
  end if;

  if new.version is distinct from old.version then
    raise exception 'Someone else changed this just now. Reload and try again.' using errcode = '40001';
  end if;
  if (to_jsonb(new) ->> 'pump_id') is distinct from (to_jsonb(old) ->> 'pump_id') then
    raise exception 'A row can''t be moved to another pump.';
  end if;

  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.version := old.version + 1;
  return new;
end;
$$;


-- ─── 7. Audit trigger ──────────────────────────────────────────────────────
-- Writes one audit_log row for every insert, update and delete. Runs with owner rights
-- so it can write to audit_log, which nobody else can.
create function private.audit_row()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_log (pump_id, table_name, record_id, action, old_values, new_values, changed_by, changed_via)
  values (
    coalesce(v_row ->> 'pump_id', case when tg_table_name = 'pumps' then v_row ->> 'id' end)::uuid,
    tg_table_name,
    (v_row ->> 'id')::uuid,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    auth.uid(),
    coalesce(auth.jwt() ->> 'role', current_user)
  );
  return null;
end;
$$;


-- ─── 8. One call adds both triggers to a table ─────────────────────────────
-- Every table except schema_migrations_applied and audit_log gets these (CLAUDE.md hard rule 5).
create function private.add_standard_triggers(p_table regclass)
returns void language plpgsql
as $$
begin
  execute format('create trigger stamp_row before insert or update on %s for each row execute function private.stamp_row()', p_table);
  execute format('create trigger audit_row after insert or update or delete on %s for each row execute function private.audit_row()', p_table);
end;
$$;

select private.add_standard_triggers('public.pumps');
select private.add_standard_triggers('public.pump_members');


-- ─── 9. Row Level Security for pumps and members ───────────────────────────
alter table public.pumps enable row level security;
alter table public.pump_members enable row level security;

create policy "Members read their pump" on public.pumps
  for select to authenticated using (private.is_member(id));
create policy "Owner changes their pump" on public.pumps
  for update to authenticated using (private.is_owner(id)) with check (private.is_owner(id));
-- New pumps are created only by the SQL editor (seed) for now.

create policy "Members see who works at their pump" on public.pump_members
  for select to authenticated using (private.is_member(pump_id));
create policy "Owner updates names and switches logins on or off" on public.pump_members
  for update to authenticated using (private.is_owner(pump_id)) with check (private.is_owner(pump_id));
-- Logins are created only by the create-user function (service role), never from the app directly.

-- Through the app, the owner may change only a member's name and whether they are active.
revoke update on public.pump_members from authenticated;
grant update (full_name, is_active, version) on public.pump_members to authenticated;

-- An owner can't be switched off (otherwise nobody could manage the pump).
create function private.owner_stays_active()
returns trigger language plpgsql
as $$
begin
  if new.role = 'OWNER' and not new.is_active then
    raise exception 'The owner''s login can''t be switched off.';
  end if;
  return new;
end;
$$;
create trigger owner_stays_active
  before update on public.pump_members
  for each row execute function private.owner_stays_active();


-- ─── 10. Linking a login to a pump (SQL editor only) ───────────────────────
-- Used by the seed to make the owner's login the pump's Owner. Not callable from the app.
create function private.link_member(p_pump uuid, p_email text, p_username text, p_full_name text, p_role text)
returns boolean language plpgsql
as $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then
    raise notice 'No login found for %. Create it in Authentication › Users, then run: select private.link_member(...)', p_email;
    return false;
  end if;
  insert into public.pump_members (pump_id, user_id, username, full_name, role)
  values (p_pump, v_user, p_username, p_full_name, p_role)
  on conflict (pump_id, user_id) do nothing;
  return true;
end;
$$;
revoke execute on function private.link_member(uuid, text, text, text, text) from public, authenticated, anon;


insert into public.schema_migrations_applied (name) values ('20260926120000_foundations');
