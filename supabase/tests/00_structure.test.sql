-- Structure rules every table must follow (CLAUDE.md hard rules 3 and 5).
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- Tables that are infrastructure, not pump data: the migration change log and the audit log itself.
create temp table exempt (name text) on commit drop;
insert into exempt values ('schema_migrations_applied'), ('audit_log');

select is(
  (select string_agg(t.table_name || '.' || c.col, ', ' order by t.table_name, c.col)
   from information_schema.tables t
   cross join (values ('id'), ('pump_id'), ('created_by'), ('created_at'), ('updated_by'), ('updated_at'), ('version')) c(col)
   where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
     and t.table_name not in (select name from exempt)
     and not (t.table_name = 'pumps' and c.col = 'pump_id')
     and not exists (select 1 from information_schema.columns ic
                     where ic.table_schema = 'public' and ic.table_name = t.table_name and ic.column_name = c.col)),
  null,
  'Every table has id, pump_id, created_by/at, updated_by/at and version'
);

select is(
  (select string_agg(c.relname, ', ') from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  null,
  'Row Level Security is on for every table'
);

select is(
  (select string_agg(t.table_name, ', ' order by t.table_name) from information_schema.tables t
   where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
     and t.table_name not in (select name from exempt)
     and (select count(*) from pg_trigger g join pg_class c on c.oid = g.tgrelid join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = t.table_name and g.tgname in ('stamp_row', 'audit_row')) <> 2),
  null,
  'Every table has the automatic stamps and the audit trigger'
);

select is(
  (select string_agg(table_name || '.' || column_name, ', ') from information_schema.columns
   where table_schema = 'public' and data_type in ('real', 'double precision')),
  null,
  'No floating-point columns anywhere (money and litres are numeric)'
);

select is(
  (select array_agg(name order by name) from public.schema_migrations_applied),
  array['20260926120000_foundations', '20260926120100_setup_tables', '20260926120200_calc_functions', '20260926120300_seed_pilot_pump', '20260927120000_day_opening', '20260927130000_shift_meters', '20260927140000_tanker', '20260927150000_sales', '20260927160000_tanker_chambers'],
  'The migration change log lists every migration, in order'
);

select * from finish();
rollback;
