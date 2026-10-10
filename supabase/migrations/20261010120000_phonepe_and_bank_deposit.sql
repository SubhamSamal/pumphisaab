-- ════════════════════════════════════════════════════════════════════════════
--  Migration 15 · 20261010120000_phonepe_and_bank_deposit   (owner, 10 Oct 2026)
--
--  WHAT IT DOES
--    • Two new boxes in each shift's Sales (D111):
--        – PhonePe, after Paytm: the shift's PhonePe total (like Paytm).
--        – Cash deposited in bank, after Bank transfer: drawer cash taken to the bank during the
--          shift (e.g. ₹50,000 to HDFC). It counts as money the shift handed over, so the shift
--          still matches. Customers never pay by it (the app leaves it out of their list).
--    • Both are ordinary "OTHER" ways of getting paid, so the shift and day maths (v_shift_money,
--      src/calc/money.ts) already count them: no formula changes.
--    • Shifts already marked Done keep their numbers; the new boxes stay empty there and change
--      nothing. Tapping Done again fills them with ₹0, like the other boxes.
--
--  DATA SAFETY:  ADDS TWO ROWS; DELETES NOTHING.
--    • INSERT two payment types per pump; UPDATE payment_types.sort_order of the types after
--      them (display order only). No payment amount is changed.
--    • No DROP · no TRUNCATE · no DELETE · no ALTER.
--
--  HOW TO APPLY:  paste the whole file into Supabase › SQL editor › Run, after migration 14.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from public.schema_migrations_applied where name = '20261003120000_pilot_fixes_1') then
    raise exception 'Apply migration 14 (20261003120000_pilot_fixes_1) first.';
  end if;
  if exists (select 1 from public.schema_migrations_applied where name = '20261010120000_phonepe_and_bank_deposit') then
    raise exception 'Migration 20261010120000_phonepe_and_bank_deposit was already applied. Nothing was changed.';
  end if;
end $$;


-- PhonePe right after Paytm: everything after Paytm moves one place down.
update public.payment_types t set sort_order = t.sort_order + 1
where t.sort_order > (select p.sort_order from public.payment_types p where p.pump_id = t.pump_id and p.name = 'Paytm')
  and not exists (select 1 from public.payment_types x where x.pump_id = t.pump_id and x.name = 'PhonePe');
insert into public.payment_types (pump_id, name, kind, sort_order)
select p.pump_id, 'PhonePe', 'OTHER', p.sort_order + 1 from public.payment_types p
where p.name = 'Paytm' and not exists (select 1 from public.payment_types x where x.pump_id = p.pump_id and x.name = 'PhonePe');

-- Cash deposited in bank right after Bank transfer.
update public.payment_types t set sort_order = t.sort_order + 1
where t.sort_order > (select b.sort_order from public.payment_types b where b.pump_id = t.pump_id and b.name = 'Bank transfer')
  and not exists (select 1 from public.payment_types x where x.pump_id = t.pump_id and x.name = 'Cash deposited in bank');
insert into public.payment_types (pump_id, name, kind, sort_order)
select b.pump_id, 'Cash deposited in bank', 'OTHER', b.sort_order + 1 from public.payment_types b
where b.name = 'Bank transfer' and not exists (select 1 from public.payment_types x where x.pump_id = b.pump_id and x.name = 'Cash deposited in bank');


insert into public.schema_migrations_applied (name) values ('20261010120000_phonepe_and_bank_deposit');
