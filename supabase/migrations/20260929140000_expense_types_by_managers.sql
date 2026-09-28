-- ════════════════════════════════════════════════════════════════════════════
--  Migration 13 · 20260929140000_expense_types_by_managers   (Phase 4, owner's 4e check)
--
--  WHAT IT DOES
--    • Managers (not only the owner) can add a new expense type while adding an expense,
--      like new companies (D50). The owner asked for "type to search, add new if not there"
--      (29 Sep, D82). Renaming, limits and switching a type off stay with the owner.
--
--  DATA SAFETY:  CHANGES PERMISSIONS ONLY; DELETES NOTHING.
--    • Adds one security rule to expense_categories. No row is changed.
--    • No DROP · no ALTER · no TRUNCATE · no DELETE.
--
--  HOW TO APPLY:  paste the whole file into Supabase › SQL editor › Run, after migration 12.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from public.schema_migrations_applied where name = '20260929130000_closing_and_submit') then
    raise exception 'Apply migration 12 (20260929130000_closing_and_submit) first.';
  end if;
  if exists (select 1 from public.schema_migrations_applied where name = '20260929140000_expense_types_by_managers') then
    raise exception 'Migration 20260929140000_expense_types_by_managers was already applied. Nothing was changed.';
  end if;
end $$;

create policy "Managers add expense types" on public.expense_categories
  for insert to authenticated with check (private.is_member(pump_id));

insert into public.schema_migrations_applied (name) values ('20260929140000_expense_types_by_managers');
