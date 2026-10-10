-- The pilot pump's setup (migration 4) is loaded exactly as agreed (decisions D30, D33, D37).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

create temp table p on commit drop as select id from public.pumps where name = 'Shree Lokanath Filling Station';

select is((select count(*) from p), 1::bigint, 'The pilot pump exists once');
select is((select count(*) from public.dip_chart_rows), 211::bigint, 'The real dip chart has 211 rows');
select is((select array_agg(capacity_l order by label) from public.tanks), array[21628.93, 21628.93]::numeric[], 'Both tanks hold 21,628.93 L (the chart''s last row), not 20,000');
select is((select array_agg(label order by sort_order) from public.nozzles where in_use), array['MS-3', 'MS-4', 'HSD-3', 'HSD-4'], 'Only nozzles 3 and 4 are in use');
select is((select array_agg(product || ' ' || per_litre order by product) from public.fuel_prices), array['HSD 101.74', 'MS 110.07'], 'Prices from 15 Sep 2026');
select is((select array_agg(name order by sort_order) from public.payment_types), array['Cash', 'Paytm', 'PhonePe', 'Debit card', 'Credit card', 'XtraPower', 'Bank transfer', 'Cash deposited in bank', 'Credit'], 'Ways of getting paid');
select is((select count(*) from public.expense_categories), 10::bigint, '10 expense types');
select is((select count(*) from public.staff) + (select count(*) from public.credit_customers), 0::bigint, 'No staff or credit customers loaded (added in the app)');
select is((select rules -> 'compliance' -> 'evaporationPercent' ->> 'HSD' from public.pumps), '0.20', 'Rules are loaded with the pump');

select * from finish();
rollback;
