// Local stand-in for Supabase: PGlite + a minimal auth schema + roles. For quick checks only.
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
const REPO = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/$/, "");
export async function freshDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text unique);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on all functions in schema auth to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  `);
  return db;
}
export async function migrate(db) {
  const dir = `${REPO}/supabase/migrations`;
  for (const f of readdirSync(dir).sort()) {
    try { await db.exec(readFileSync(`${dir}/${f}`, "utf8")); console.log("applied", f); }
    catch (e) { console.log("FAILED", f, "\n ", e.message); throw e; }
  }
}
if (process.argv[2] === "migrate") {
  const db = await freshDb();
  await db.exec(`insert into auth.users values ('00000000-0000-0000-0000-00000000000a', 'subham@users.pumphisaab.com')`);
  await migrate(db);
  const q = async (s) => (await db.query(s)).rows;
  console.log(await q(`select name from public.schema_migrations_applied order by name`));
  console.log(await q(`select label, product, capacity_l from public.tanks order by label`));
  console.log(await q(`select count(*) rows, min(dip_cm), max(dip_cm) from public.dip_chart_rows`));
  console.log(await q(`select round(public.dip_to_litres((select id from dip_charts), 123.4), 2) a, public.dip_to_litres((select id from dip_charts), 210.1) b, round(public.dip_to_litres((select id from dip_charts), 128.5),2) c`));
  console.log(await q(`select public.business_date_at('2026-10-02 02:00+05:30', '06:00', 'Asia/Kolkata') d1, public.business_date_at('2026-10-01 06:00+05:30', '06:00', 'Asia/Kolkata') d2`));
  console.log(await q(`select public.price_for(id, 'HSD', '2026-09-15') p1, public.price_for(id, 'HSD', '2026-09-14') p2 from pumps`));
  console.log(await q(`select username, role from pump_members`));
  console.log(await q(`select table_name, action, count(*) from audit_log group by 1,2 order by 1`));
}
