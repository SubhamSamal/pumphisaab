-- DATA SAFETY: READ ONLY. Changes nothing (only SELECT). Safe to run any time.
-- Why: the owner wants 2-5 Oct filled from the notebooks. This shows exactly what the app holds for
-- 01-09 Oct (how 1 Oct was filled, and whether anything was already typed for 2-5 Oct), plus the
-- name lists (companies, staff, expense types) so the notebook names can be matched.
-- How: paste in Supabase › SQL editor › Run. One cell comes back: click it › copy › paste to Claude.

with p as (select id from public.pumps limit 1),
days as (
  select d.* from public.business_days d, p
  where d.pump_id = p.id and d.business_date between date '2026-09-30' and date '2026-10-09'
)
select (jsonb_build_object(
  'days', (select jsonb_agg(jsonb_build_object(
      'date', d.business_date, 'status', d.status, 'ms_price', d.ms_price, 'hsd_price', d.hsd_price,
      'price_confirmed', d.price_confirmed_at is not null, 'no_tanker', d.no_tanker, 'no_expenses', d.no_expenses,
      'tank', (select jsonb_agg(jsonb_build_object('tank', t.label, 'type', r.reading_type, 'cm', r.dip_cm, 'l', round(r.dip_l, 2), 'book', r.book_stock_l) order by t.label, r.reading_type desc)
               from public.tank_readings r join public.tanks t on t.id = r.tank_id where r.day_id = d.id),
      'shifts', (select jsonb_agg(jsonb_build_object(
          'shift', s.shift_code, 'opening_cash', s.opening_cash, 'sales_done', s.sales_done_at is not null,
          'staff', (select jsonb_agg(st.name) from public.shift_attendants a join public.staff st on st.id = a.staff_id where a.shift_id = s.id),
          'meters', (select jsonb_agg(jsonb_build_object('n', n.label, 'o', r.opening, 'c', r.closing, 'typed', r.opening_typed, 'chg', r.meter_change_status) order by n.sort_order)
                     from public.nozzle_readings r join public.nozzles n on n.id = r.nozzle_id where r.shift_id = s.id),
          'tests', (select jsonb_agg(jsonb_build_object('n', n.label, 'l', t.litres)) from public.nozzle_tests t join public.nozzles n on n.id = t.nozzle_id where t.shift_id = s.id),
          'pay', (select jsonb_agg(jsonb_build_object('type', pt.name, 'amt', sp.amount, 'coins', sp.coins) order by pt.sort_order)
                  from public.shift_payments sp join public.payment_types pt on pt.id = sp.payment_type_id where sp.shift_id = s.id),
          'notes', (select jsonb_agg(jsonb_build_object('v', cd.value, 'n', cc.note_count)) from public.cash_counts cc join public.cash_denominations cd on cd.id = cc.denomination_id where cc.shift_id = s.id and cc.note_count > 0),
          'slips', (select jsonb_agg(jsonb_build_object('co', cu.name, 'slip', cs.slip_no, 'veh', cs.vehicle_no, 'p', cs.product, 'by', cs.entry_by, 'rs', cs.rupees, 'l', cs.litres) order by cs.created_at)
                    from public.credit_sales cs join public.credit_customers cu on cu.id = cs.customer_id where cs.shift_id = s.id),
          'dues_paid', (select jsonb_agg(jsonb_build_object('co', cu.name, 'how', pt.name, 'amt', cp.amount))
                        from public.customer_payments cp join public.credit_customers cu on cu.id = cp.customer_id join public.payment_types pt on pt.id = cp.payment_type_id where cp.shift_id = s.id),
          'money', (select to_jsonb(m) - 'shift_id' - 'day_id' - 'pump_id' - 'shift_code' from public.v_shift_money m where m.shift_id = s.id)
        ) order by s.starts_at) from public.shifts s where s.day_id = d.id),
      'expenses', (select jsonb_agg(jsonb_build_object('type', ec.name, 'desc', e.description, 'amt', e.amount, 'from', e.paid_from) order by e.created_at)
                   from public.expenses e join public.expense_categories ec on ec.id = e.category_id where e.day_id = d.id),
      'tankers', (select jsonb_agg(jsonb_build_object('veh', tr.vehicle_no, 'inv', tr.invoice_no, 'inv_date', tr.invoice_date,
          'lines', (select jsonb_agg(jsonb_build_object('p', rl.product, 'ordered', rl.ordered_l, 'short', rl.short_l, 'price', rl.price_per_l, 'margin', rl.margin_per_l,
                      'before_cm', rl.dip_before_cm, 'after_cm', rl.dip_after_cm,
                      'chambers', (select jsonb_agg(jsonb_build_object('no', rc.chamber_no, 'l', rc.litres, 'after_cm', rc.dip_after_cm, 'next_day', rc.next_day) order by rc.chamber_no)
                                   from public.receipt_chambers rc where rc.receipt_line_id = rl.id)))
                    from public.receipt_lines rl where rl.receipt_id = tr.id)))
                  from public.tanker_receipts tr where tr.day_id = d.id),
      'match', (select jsonb_agg(jsonb_build_object('p', m.product, 'tank', round(m.sold_as_per_tank, 2), 'meters', round(m.sold_as_per_meters, 2), 'diff', round(m.difference, 2), 'recv', m.received_l))
                from public.v_day_match m where m.day_id = d.id)
    ) order by d.business_date) from days d),
  'companies', (select jsonb_agg(c.name order by c.name) from public.credit_customers c, p where c.pump_id = p.id and c.is_active),
  'staff', (select jsonb_agg(s.name order by s.name) from public.staff s, p where s.pump_id = p.id and s.is_active),
  'expense_types', (select jsonb_agg(c.name order by c.sort_order) from public.expense_categories c, p where c.pump_id = p.id and c.is_active),
  'payment_types', (select jsonb_agg(t.name || ' (' || t.kind || ')' order by t.sort_order) from public.payment_types t, p where t.pump_id = p.id and t.is_active),
  'nozzles', (select jsonb_agg(n.label || case when n.in_use then '' else ' (not in use)' end order by n.sort_order) from public.nozzles n, p where n.pump_id = p.id),
  'prices', (select jsonb_agg(jsonb_build_object('p', f.product, 'rs', f.per_litre, 'from', f.starts_on) order by f.starts_on) from public.fuel_prices f, p where f.pump_id = p.id)
)) as everything;
