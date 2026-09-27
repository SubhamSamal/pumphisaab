import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { freshDb, migrate } from "./harness.mjs";
const REPO = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/$/, "");
const stub = readFileSync(new URL("./pgtap-stub.sql", import.meta.url), "utf8");
const only = process.argv[2];
for (const f of readdirSync(`${REPO}/supabase/tests`).sort()) {
  if (only && !f.includes(only)) continue;
  const db = await freshDb();
  await migrate(db).catch(() => process.exit(1));
  await db.exec(stub);
  const sql = readFileSync(`${REPO}/supabase/tests/${f}`, "utf8").replace(/create extension if not exists pgtap[^;]*;/, "");
  try {
    const res = await db.exec(sql);
    const fin = res.flatMap((r) => r.rows).find((r) => r.finish)?.finish;
    console.log(`✓ ${f}: ${fin}`);
  } catch (e) { console.log(`✗ ${f}\n  ${e.message}`); }
}
