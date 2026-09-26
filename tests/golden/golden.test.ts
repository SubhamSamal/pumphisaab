/**
 * Golden cases: every file in tests/golden/cases is a real or worked example with known answers.
 * The same files will also check the database's maths (Phase 3), so app and database always agree.
 *
 * Numbers in "expected" are compared at the decimals they are written with:
 * "13215.37" checks the engine's answer rounded to 2 decimals.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkChart,
  DEFAULT_RULES,
  dipToLitres,
  evaluateDay,
  priceFor,
  receiptTotals,
  slipAmounts,
  type DayInput,
  type DipChartRow,
  type Rules,
} from "@/calc";
import { businessDateAt } from "@/lib/businessDay";
import { Decimal } from "@/lib/decimal";

const DIR = join(__dirname);

// ─── Charts ────────────────────────────────────────────────────────────────
const realChart = JSON.parse(readFileSync(join(DIR, "charts/iocl-20kl.json"), "utf8")) as { rows: [string, string][] };
const CHARTS: Record<string, DipChartRow[]> = {
  "iocl-20kl": realChart.rows.map(([dipCm, litres]) => ({ dipCm, litres })),
  // Test chart for the PRD examples, which are given in litres: 1 cm = 100 L, up to 300 cm.
  "linear-100": Array.from({ length: 301 }, (_, cm) => ({ dipCm: String(cm), litres: String(cm * 100) })),
};

// ─── Helpers ───────────────────────────────────────────────────────────────
function decimalsIn(expected: string): number {
  const dot = expected.indexOf(".");
  return dot === -1 ? 0 : expected.length - dot - 1;
}

function expectNumber(actual: Decimal | null | undefined, expected: string | null, what: string) {
  if (expected === null) {
    expect(actual ?? null, what).toBeNull();
    return;
  }
  expect(actual, `${what} is missing`).toBeTruthy();
  const n = decimalsIn(expected);
  expect((actual as Decimal).toDecimalPlaces(n, Decimal.ROUND_HALF_UP).toFixed(n), what).toBe(new Decimal(expected).toFixed(n));
}

function withRules(overrides: Partial<Rules> | undefined): Rules {
  return overrides ? { ...DEFAULT_RULES, ...overrides } : DEFAULT_RULES;
}

type RawDay = Omit<DayInput, "tanks"> & { tanks: { id: string; label: string; product: "MS" | "HSD"; chart: string }[] };
function resolveCharts(input: RawDay): DayInput {
  return { ...input, tanks: input.tanks.map((t) => ({ ...t, chart: CHARTS[t.chart] })) };
}

const sorted = (codes: string[]) => [...codes].sort();

// ─── Runner ────────────────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any -- golden files are plain JSON */
const files = readdirSync(join(DIR, "cases")).filter((f) => f.endsWith(".json")).sort();

describe("golden cases", () => {
  it("has the cases the plan promised (30+ checks across these files)", () => {
    expect(files.length).toBeGreaterThanOrEqual(25);
  });

  for (const file of files) {
    const c = JSON.parse(readFileSync(join(DIR, "cases", file), "utf8"));
    const rules = withRules(c.rules);

    it(`${file}: ${c.description}`, () => {
      switch (c.kind) {
        case "dip": {
          const { chart } = checkChart(CHARTS[c.chart]);
          expect(chart).not.toBeNull();
          for (const r of c.readings) expectNumber(dipToLitres(chart!, r.dipCm), r.litres, `${r.dipCm} cm`);
          break;
        }
        case "chart": {
          for (const ch of c.charts) {
            const { chart, problems } = checkChart(ch.rows.map(([dipCm, litres]: string[]) => ({ dipCm, litres })));
            if (ch.ok) {
              expect(problems, ch.name).toEqual([]);
              expect(chart!.rows.length, ch.name).toBe(ch.rowsAfter);
              expectNumber(chart!.capacityLitres, ch.capacityLitres, `${ch.name} capacity`);
            } else {
              expect(chart, ch.name).toBeNull();
              expect(problems.map((p) => p.row), ch.name).toEqual(ch.problemRows);
            }
          }
          break;
        }
        case "price": {
          for (const l of c.lookups) expectNumber(priceFor(c.prices, l.product, l.date), l.perLitre, `${l.product} on ${l.date}`);
          break;
        }
        case "slip": {
          for (const s of c.slips) {
            const { litres, rupees } = slipAmounts({ slipNo: "x", customer: "x", vehicleNo: "x", product: "HSD", entry: s.entry }, new Decimal(c.rate), withRules(s.rules));
            expectNumber(litres, s.litres, `litres for ${JSON.stringify(s.entry)}`);
            expectNumber(rupees, s.rupees, `rupees for ${JSON.stringify(s.entry)}`);
          }
          break;
        }
        case "tanker": {
          const r = receiptTotals(c.receipt, new Map());
          expectNumber(r.lines[0].receivedNetLitres, c.expected.receivedNetLitres, "received");
          expectNumber(r.totalAmount, c.expected.totalAmount, "amount");
          expectNumber(r.totalShortAmount, c.expected.totalShortAmount, "short amount");
          expectNumber(r.toPay, c.expected.toPay, "to pay");
          expectNumber(r.totalMargin, c.expected.totalMargin, "margin");
          break;
        }
        case "day": {
          const result = evaluateDay(resolveCharts(c.input), rules);
          const e = c.expected;

          if (e.products) {
            expect(sorted(result.products.map((p) => p.product)), "fuels worked out").toEqual(sorted(Object.keys(e.products)));
            for (const [fuel, want] of Object.entries<any>(e.products)) {
              const got: any = result.products.find((p) => p.product === fuel);
              for (const [key, value] of Object.entries<any>(want)) {
                if (typeof value === "boolean") expect(got[key], `${fuel} ${key}`).toBe(value);
                else expectNumber(got[key], value, `${fuel} ${key}`);
              }
            }
          }

          if (e.shifts) {
            expect(sorted(result.shifts.map((s) => s.shift)), "shifts worked out").toEqual(sorted(Object.keys(e.shifts)));
            for (const [code, want] of Object.entries<any>(e.shifts)) {
              const got: any = result.shifts.find((s) => s.shift === code);
              for (const [key, value] of Object.entries<any>(want)) {
                const actual = key in got ? got[key] : got.receivedParts[key];
                if (typeof value === "boolean") expect(actual, `Shift ${code} ${key}`).toBe(value);
                else expectNumber(actual, value, `Shift ${code} ${key}`);
              }
            }
          }

          if (e.tankers) {
            for (const [id, want] of Object.entries<any>(e.tankers)) {
              const line: any = result.tankers.find((t) => t.id === id)!.lines[0];
              for (const [key, value] of Object.entries<any>(want)) expectNumber(line[key], value, `tanker ${id} ${key}`);
            }
          }

          if (e.hardErrors) expect(sorted(result.hardErrors.map((i) => i.code)), "hard errors").toEqual(sorted(e.hardErrors));
          if (e.flags) expect(sorted(result.flags.map((i) => i.code)), "flags").toEqual(sorted(e.flags));
          if ("isMatched" in e) expect(result.isMatched, "matched").toBe(e.isMatched);
          break;
        }
        case "businessDate": {
          for (const b of c.cases) expect(businessDateAt(new Date(b.at), b.dayStart), `${b.at} (day starts ${b.dayStart})`).toBe(b.businessDate);
          break;
        }
        default:
          throw new Error(`Unknown case kind in ${file}: ${c.kind}`);
      }
    });
  }
});
