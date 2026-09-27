import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@/calc";
import { daysNotSubmitted, evaluate, priceStrip, sectionsDone, tankDays, todaySections } from "./model";
import type { Day, DaySetup, TankReading } from "./queries";

const chart = (JSON.parse(readFileSync(join(__dirname, "../../../tests/golden/charts/iocl-20kl.json"), "utf8")).rows as [string, string][]).map(
  ([dipCm, litres]) => ({ dipCm, litres }),
);

const setup: DaySetup = {
  tanks: [
    { id: "ms", label: "MS-1", product: "MS", chartId: "c", isActive: true },
    { id: "hsd", label: "HSD-1", product: "HSD", chartId: "c", isActive: true },
  ],
  charts: { c: chart },
  prices: [
    { product: "MS", perLitre: "110.07", startsOn: "2026-09-15" },
    { product: "HSD", perLitre: "101.74", startsOn: "2026-09-15" },
  ],
  rules: DEFAULT_RULES,
  firstBusinessDate: "2026-09-28",
};

const day = (over: Partial<Day> = {}): Day => ({
  id: "d",
  businessDate: "2026-10-01",
  status: "DRAFT",
  isLocked: false,
  ownerOpened: false,
  confirmed: {},
  now: { MS: "110.07", HSD: "101.74" },
  priceConfirmed: false,
  noTanker: false,
  noExpenses: false,
  version: 1,
  ...over,
});

const reading = (tankId: string, dipCm: string | null, book: string | null = null): TankReading => ({
  id: tankId,
  tankId,
  type: "OPENING",
  dipCm,
  bookStockLitres: book,
  version: 1,
});

describe("opening dip on Today", () => {
  it("is a grey 'To do' until a dip is typed, amber part-way, green when every tank has one", () => {
    const run = (readings: TankReading[]) => {
      const result = evaluate(setup, day(), tankDays(setup, readings, []));
      return todaySections(setup, day(), readings, result)[0];
    };
    expect(run([])).toMatchObject({ status: "todo", subtitle: "To do · 2 tanks", ready: true });
    expect(run([reading("hsd", "59.8")])).toMatchObject({ status: "inProgress", subtitle: "1 of 2 tanks" });
    expect(run([reading("hsd", "59.8"), reading("ms", "55.2")])).toMatchObject({ status: "done", subtitle: "Done · 2 tanks" });
  });

  it("counts S7 as an amber flag when the dip jumped from last night (engine decides)", () => {
    const readings = [reading("hsd", "129.1"), reading("ms", "128.9")];
    const yesterday = [
      { tankId: "hsd", closingDipCm: "128.5", bookGapLitres: null },
      { tankId: "ms", closingDipCm: "128.5", bookGapLitres: null },
    ];
    const result = evaluate(setup, day(), tankDays(setup, readings, yesterday));
    expect(result.flags.map((f) => f.code)).toEqual(["S7"]);
    expect(todaySections(setup, day(), readings, result)[0].flags).toBe(1);
  });

  it("uses what is typed over what is saved, and an emptied box as empty", () => {
    const saved = [reading("hsd", "59.8", "9700")];
    expect(tankDays(setup, saved, [], { hsd: { openingDipCm: "60" } })[0]).toMatchObject({ openingDipCm: "60", bookStockLitres: "9700" });
    expect(tankDays(setup, saved, [], { hsd: { openingDipCm: null } })).toEqual([]);
  });

  it("shows every section locked on a locked day, and only the opening dip opens for now", () => {
    const result = evaluate(setup, day({ isLocked: true }), []);
    const sections = todaySections(setup, day({ isLocked: true }), [], result);
    expect(sections).toHaveLength(8);
    expect(sections.every((s) => s.status === "locked")).toBe(true);
    expect(sections.filter((s) => s.ready).map((s) => s.key)).toEqual(["openingDip"]);
    expect(sectionsDone(sections)).toBe(0);
  });
});

describe("submit yesterday first (D3) and not-submitted warnings (D49)", () => {
  it("warns about yesterday and the day before if not submitted or never started", () => {
    expect(daysNotSubmitted("2026-10-01", "2026-09-28", [])).toEqual(["2026-09-30", "2026-09-29"]);
    expect(daysNotSubmitted("2026-10-01", "2026-09-28", [{ business_date: "2026-09-30", status: "SUBMITTED" }])).toEqual(["2026-09-29"]);
    expect(
      daysNotSubmitted("2026-10-01", "2026-09-28", [
        { business_date: "2026-09-30", status: "LOCKED" },
        { business_date: "2026-09-29", status: "SUBMITTED" },
      ]),
    ).toEqual([]);
  });

  it("never warns about days before the pump's first day in the app", () => {
    expect(daysNotSubmitted("2026-09-28", "2026-09-28", [])).toEqual([]);
    expect(daysNotSubmitted("2026-09-29", "2026-09-28", [])).toEqual(["2026-09-28"]);
  });
});

describe("price Confirm strip (H6)", () => {
  it("asks for a one-tap confirm when prices are the same as yesterday", () => {
    expect(priceStrip(setup, day())).toEqual({
      state: "toConfirm",
      note: "Same as yesterday",
      missing: [],
      items: [
        { product: "HSD", price: "₹101.74" },
        { product: "MS", price: "₹110.07" },
      ],
    });
  });

  it("shows old and new side by side when the owner changed a price from today", () => {
    const changed = { ...setup, prices: [...setup.prices, { product: "HSD" as const, perLitre: "102.00", startsOn: "2026-10-01" }] };
    expect(priceStrip(changed, day({ now: { MS: "110.07", HSD: "102.00" } }))).toMatchObject({
      state: "changed",
      items: [{ product: "HSD", price: "₹102.00", was: "₹101.74" }, { product: "MS", price: "₹110.07" }],
    });
  });

  it("asks again if the owner changed the price after it was confirmed", () => {
    const s = priceStrip(setup, day({ confirmed: { MS: "110.07", HSD: "101.74" }, now: { MS: "110.07", HSD: "102.5" } }));
    expect(s.state).toBe("changed");
    expect(s.items[0]).toEqual({ product: "HSD", price: "₹102.50", was: "₹101.74" });
  });

  it("shows the confirmed prices once confirmed, and names a missing price", () => {
    expect(priceStrip(setup, day({ priceConfirmed: true, confirmed: { MS: "110.07", HSD: "101.74" } })).state).toBe("confirmed");
    expect(priceStrip(setup, day({ now: { HSD: "101.74" } })).missing).toEqual(["MS"]);
  });
});
