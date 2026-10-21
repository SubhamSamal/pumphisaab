-- ════════════════════════════════════════════════════════════════════════════
--  Migration 18 · 20261021130000_settlement_pending   (Phase 5a Part 3, owner, 03 Oct / 21 Oct 2026)
--
--  WHAT IT DOES
--    • "Not settled yet" (D103): per day and per way of payment (Paytm, PhonePe, XtraPower, cards),
--      the part of the day's machine total that hasn't reached the bank yet. It is for the owner's
--      money follow-up only: it NEVER changes Should have, Received or any Difference (the shift
--      boxes keep the machine's full total, which is what the money check needs).
--
--  DATA SAFETY:  ADDS ONLY; DELETES NOTHING.
--    • CREATE TABLE settlement_pending (new, empty) with the standard columns, Row Level Security
--      and the audit trigger. No existing table or row is changed.
--    • No DROP · no TRUNCATE · no DELETE · no ALTER of existing tables.
--
--  HOW TO APPLY:  paste the whole file into Supabase › SQL editor › Run, after migration 17.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from public.schema_migrations_applied where name = '20261021120000_nozzle_checks_and_attendants') then
    raise exception 'Apply migration 17 (20261021120000_nozzle_checks_and_attendants) first.';
  end if;
  if exists (select 1 from public.schema_migrations_applied where name = '20261021130000_settlement_pending') then
    raise exception 'Migration 20261021130000_settlement_pending was already applied. Nothing was changed.';
  end if;
end $$;


create table public.settlement_pending (
  id               uuid primary key default gen_random_uuid(),
  pump_id          uuid not null references public.pumps (id),
  day_id           uuid not null references public.business_days (id),
  payment_type_id  uuid not null references public.payment_types (id),
  amount           numeric(12, 2) not null check (amount >= 0),   -- H5
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_by       uuid,
  updated_at       timestamptz not null default now(),
  version          integer not null default 1,
  unique (day_id, payment_type_id)
);

-- Only the pump's own "OTHER" ways of payment (Paytm, cards, XtraPower …), never cash or credit.
create function private.settlement_type_ok()
returns trigger language plpgsql
as $$
begin
  if not exists (select 1 from public.payment_types t where t.id = new.payment_type_id and t.pump_id = new.pump_id and t.kind = 'OTHER') then
    raise exception 'Not settled is only for Paytm, cards, XtraPower and the like.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger settlement_type_ok before insert or update on public.settlement_pending for each row execute function private.settlement_type_ok();
create trigger day_must_be_open before insert or update or delete on public.settlement_pending for each row execute function private.day_must_be_open();
select private.add_standard_triggers('public.settlement_pending');

alter table public.settlement_pending enable row level security;
create policy "Members read" on public.settlement_pending for select to authenticated using (private.is_member(pump_id));
create policy "Members add" on public.settlement_pending for insert to authenticated with check (private.is_member(pump_id));
create policy "Members change" on public.settlement_pending for update to authenticated using (private.is_member(pump_id)) with check (private.is_member(pump_id));
create policy "Members remove" on public.settlement_pending for delete to authenticated using (private.is_member(pump_id));


insert into public.schema_migrations_applied (name) values ('20261021130000_settlement_pending');
