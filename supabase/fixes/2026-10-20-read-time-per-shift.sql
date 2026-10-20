-- DATA SAFETY: READ ONLY. Changes nothing (only SELECT). Safe to run any time.
-- Why (Phase 5a Part 1, D116): the goal is a shift filled in 10-15 minutes or less. Before making
-- the app faster, this shows how long real shifts took and which part was slowest, from the change
-- history the app already keeps (every save is stamped with who and when).
-- "Active minutes" adds up only the gaps of 5 minutes or less between one save and the next, so a
-- tea break or the shift's own hours don't count; "first to last" is the whole stretch.
-- Days typed by a SQL file (02-05 Oct back-fill) have no person on them and are left out.
-- How: paste in Supabase › SQL editor › Run. One cell comes back: click it › copy › paste to Claude.

with p as (select id from public.pumps order by created_at limit 1),
ev as (
  select a.changed_at, a.changed_by, a.table_name, coalesce(a.new_values, a.old_values) as v
  from public.audit_log a, p
  where a.pump_id = p.id
    and a.changed_by is not null
    and not (a.table_name = 'shifts' and a.action = 'INSERT') -- shifts are made when the day is opened, not typed
    and a.changed_at >= timestamptz '2026-10-01 06:00+05:30'
    and a.table_name in ('nozzle_readings', 'nozzle_tests', 'shift_attendants', 'shift_payments', 'cash_counts', 'shifts',
                         'credit_sales', 'customer_payments', 'tank_readings', 'tanker_receipts', 'receipt_lines',
                         'receipt_chambers', 'expenses')
),
tagged as (
  select e.changed_at, e.changed_by,
    case
      when e.table_name in ('nozzle_readings', 'nozzle_tests', 'shift_attendants') then 'meters and tests'
      when e.table_name in ('shift_payments', 'cash_counts', 'shifts') then 'cash and payments'
      when e.table_name = 'credit_sales' then 'credit slips'
      when e.table_name = 'customer_payments' then 'customer payments'
      when e.table_name = 'tank_readings' then 'dips'
      when e.table_name in ('tanker_receipts', 'receipt_lines', 'receipt_chambers') then 'tanker'
      else 'expenses'
    end as part,
    case when e.table_name = 'shifts' then (e.v ->> 'id')::uuid else (e.v ->> 'shift_id')::uuid end as shift_id,
    case when e.table_name = 'shifts' then (select s.day_id from public.shifts s where s.id = (e.v ->> 'id')::uuid)
         else (e.v ->> 'day_id')::uuid end as day_id
  from ev e
),
gaps as (
  -- The time since the previous save in the same shift (or the same day, for day-level parts).
  select t.*,
    extract(epoch from t.changed_at - lag(t.changed_at) over (partition by t.day_id, t.shift_id order by t.changed_at)) / 60 as gap_min,
    extract(epoch from t.changed_at - lag(t.changed_at) over (partition by t.day_id, t.shift_id, t.part order by t.changed_at)) / 60 as part_gap_min
  from tagged t
  where t.day_id is not null
),
per_part as (
  select g.day_id, g.shift_id, g.part, count(*) as saves,
    round(coalesce(sum(g.part_gap_min) filter (where g.part_gap_min <= 5), 0), 1) as active_min
  from gaps g group by g.day_id, g.shift_id, g.part
),
per_group as (
  select g.day_id, g.shift_id, count(*) as saves,
    round(coalesce(sum(g.gap_min) filter (where g.gap_min <= 5), 0), 1) as active_min,
    round(extract(epoch from max(g.changed_at) - min(g.changed_at)) / 60, 0) as first_to_last_min,
    to_char(min(g.changed_at) at time zone 'Asia/Kolkata', 'HH24:MI') as first_save,
    to_char(max(g.changed_at) at time zone 'Asia/Kolkata', 'HH24:MI') as last_save,
    (select string_agg(distinct m.full_name, ', ') from gaps x join public.pump_members m on m.user_id = x.changed_by
     where x.day_id = g.day_id and x.shift_id is not distinct from g.shift_id) as typed_by
  from gaps g group by g.day_id, g.shift_id
)
select jsonb_pretty(jsonb_build_object(
  'rows', (select jsonb_agg(jsonb_build_object(
      'date', d.business_date,
      'shift', coalesce(s.shift_code, 'day (dips, tanker, expenses)'),
      'active_min', g.active_min,
      'first_to_last_min', g.first_to_last_min,
      'first', g.first_save, 'last', g.last_save,
      'saves', g.saves,
      'by', g.typed_by,
      'parts', (select jsonb_object_agg(pp.part, jsonb_build_object('active_min', pp.active_min, 'saves', pp.saves))
                from per_part pp where pp.day_id = g.day_id and pp.shift_id is not distinct from g.shift_id),
      'slips', (select count(*) from public.credit_sales c where c.shift_id = g.shift_id)
    ) order by d.business_date, s.shift_code nulls last)
    from per_group g
    join public.business_days d on d.id = g.day_id
    left join public.shifts s on s.id = g.shift_id),
  'average_active_min_per_shift', (select round(avg(g.active_min), 1) from per_group g where g.shift_id is not null),
  'average_by_part_per_shift', (select jsonb_object_agg(x.part, x.avg_min) from (
      select pp.part, round(avg(pp.active_min), 1) as avg_min from per_part pp where pp.shift_id is not null group by pp.part) x)
)) as time_per_shift;
