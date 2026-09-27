create or replace function plan(n int) returns text language plpgsql as $$
begin
  create temp table if not exists tap(n serial, ok boolean, description text, detail text);
  create temp table if not exists tap_plan(n int); delete from tap_plan; insert into tap_plan values (n);
  return 'plan ' || n;
end $$;
create or replace function _rec(p_ok boolean, p_desc text, p_detail text) returns text language plpgsql security definer as $$
begin insert into tap(ok, description, detail) values (coalesce(p_ok,false), p_desc, p_detail); return case when p_ok then 'ok ' else 'not ok ' end || p_desc; end $$;
create or replace function ok(b boolean, d text) returns text language sql as $$ select _rec(b, d, null) $$;
create or replace function "is"(have anyelement, want anyelement, d text) returns text language sql as $$
  select _rec(have is not distinct from want, d, 'have=' || coalesce(have::text,'NULL') || ' want=' || coalesce(want::text,'NULL')) $$;
create or replace function lives_ok(q text, d text) returns text language plpgsql as $$
begin begin execute q; return _rec(true, d, null); exception when others then return _rec(false, d, sqlstate || ': ' || sqlerrm); end; end $$;
create or replace function throws_ok(q text, code text, msg text, d text) returns text language plpgsql as $$
begin
  begin execute q; exception when others then
    return _rec((code is null or sqlstate = code) and (msg is null or sqlerrm = msg), d, 'got ' || sqlstate || ': ' || sqlerrm);
  end;
  return _rec(false, d, 'no error was raised');
end $$;
create or replace function finish() returns setof text language plpgsql security definer as $$
declare failures text; planned int; ran int;
begin
  select n into planned from tap_plan; select count(*) into ran from tap;
  select string_agg(description || '  [' || coalesce(detail,'') || ']', E'\n  ') into failures from tap where not ok;
  if failures is not null or planned <> ran then
    raise exception E'FAILED (planned %, ran %):\n  %', planned, ran, coalesce(failures, '(count mismatch)');
  end if;
  return next 'all ' || ran || ' passed';
end $$;
