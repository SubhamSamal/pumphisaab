import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { buildGoldenSql } from "./golden-to-sql.mjs";

it("the database golden test is up to date with tests/golden (run `npm run golden:sql` if this fails)", () => {
  expect(readFileSync("supabase/tests/03_golden.test.sql", "utf8")).toBe(buildGoldenSql());
});
