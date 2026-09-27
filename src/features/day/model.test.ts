import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@/calc";
import { daysNotSubmitted, evaluate, openingOf, priceStrip, sectionsDone, shiftInputs, shiftProgress, tankDays, todaySections } from "./model";
import type { Day, DaySetup, NozzleLine, ShiftData, TankReading } from "./queries";

const chart = (JSON.parse(readFileSync(join(__dirname, "../../../tests/golden/charts/iocl-20kl.json"), "utf8")).rows as [string, string][]).map(
  ([dipCm, litres]) => ({ dipCm, litres }),
);

const setup: DaySetup = {
  tanks: [
    { id: "ms", label: "MS-1", product: "MS", chartId: "c", isActive: true },
    { id: "hsd", label: "HSD-1", product: "HSD", chartId: "c", isActive: true },
  ],
  nozzles: [
    { id: "hsd3", label: "HSD-3", product: "HSD", tankId: "hsd", inUse: true },
    { id: "hsd4", label: "HSD-4", product: "HSD", tankId: "hsd", inUse: true },
    { id: "ms3", label: "MS-3", product: "MS", tankId: "ms", inUse: true },
    { id: "ms1", label: "MS-1", product: "MS", tankId: "ms", inUse: false },
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

describe("shift meters (slice 4b)", () => {
  const shifts = [
    { id: "A", code: "A", startsAt: "2026-10-01T00:30:00Z", endsAt: "2026-10-01T08:30:00Z" },
    { id: "B", code: "B", startsAt: "2026-10-01T08:30:00Z", endsAt: "2026-10-01T16:30:00Z" },
    { id: "C", code: "C", startsAt: "2026-10-01T16:30:00Z", endsAt: "2026-10-02T00:30:00Z" },
  ];
  const line = (shiftId: string, nozzleId: string, over: Partial<NozzleLine> = {}): NozzleLine => ({
    shiftId,
    nozzleId,
    readingId: null,
    version: null,
    opening: null,
    openingTyped: false,
    closing: null,
    meterChange: "NONE",
    hasPrevious: true,
    previousClosing: null,
    ...over,
  });
  const data = (lines: NozzleLine[], extra: Partial<ShiftData> = {}): ShiftData => ({ shifts, lines, attendants: [], tests: [], ...extra });

  it("copies the opening from the previous closing until one is typed", () => {
    expect(openingOf(line("B", "hsd3", { previousClosing: "1100" }))).toBe("1100");
    expect(openingOf(line("B", "hsd3", { opening: "1300", openingTyped: true, previousClosing: "1100" }))).toBe("1300");
    expect(openingOf(line("B", "hsd3"))).toBeNull();
  });

  it("feeds the engine: sale = closing − opening, testing taken off, H2 when the opening moved", () => {
    const d = data(
      [
        line("A", "hsd3", { opening: "1000", closing: "1100", hasPrevious: false }),
        line("B", "hsd3", { opening: "1300", openingTyped: true, closing: "1400", previousClosing: "1100", meterChange: "PENDING" }),
      ],
      { tests: [{ id: "t", shiftId: "A", nozzleId: "hsd3", litres: "10", version: 1 }] },
    );
    const inputs = shiftInputs(setup, d);
    const result = evaluate(setup, day(), [], inputs);
    expect(result.hardErrors.filter((e) => e.code === "H2").map((e) => e.where?.shift)).toEqual(["B"]);
    expect(result.products.find((p) => p.product === "HSD")).toBeUndefined(); // no dips yet, so no tank match
    expect(inputs[0].tests).toEqual([{ nozzleId: "hsd3", litres: "10" }]);
    const approved = shiftInputs(setup, data([line("B", "hsd3", { opening: "1300", openingTyped: true, closing: "1400", previousClosing: "1100", meterChange: "APPROVED" })]));
    expect(evaluate(setup, day(), [], approved).hardErrors.filter((e) => e.code === "H2")).toEqual([]);
  });

  it("is done when every in-use nozzle has both readings and someone is ticked", () => {
    const lines = [
      line("A", "hsd3", { opening: "1000", closing: "1100" }),
      line("A", "hsd4", { opening: "2000", closing: "2050" }),
      line("A", "ms3", { opening: "500" }),
    ];
    const shift = shifts[0];
    expect(shiftProgress(shift, setup, data(lines))).toMatchObject({ typedCount: 2, total: 3, done: false, started: true });
    expect(shiftProgress(shift, setup, data(lines), { "A:ms3": "520" })).toMatchObject({ typedCount: 3, people: 0, done: false });
    // A closing below the opening (H1) is not "typed": the shift can't look done with it.
    expect(shiftProgress(shift, setup, data(lines), { "A:ms3": "5" }).typedCount).toBe(2);
    // A first opening typed on screen (not saved yet) counts too.
    const noOpening = [lines[0], lines[1], line("A", "ms3", { hasPrevious: false })];
    expect(shiftProgress(shift, setup, data(noOpening), { "open:A:ms3": "500", "A:ms3": "520" }).typedCount).toBe(3);
    const withPeople = data(lines, { attendants: [{ id: "x", shiftId: "A", staffId: "s" }] });
    expect(shiftProgress(shift, setup, withPeople, { "A:ms3": "520" }).done).toBe(true);
  });

  it("shows each shift card's one line", () => {
    const d = data([line("A", "hsd3", { opening: "1000", closing: "1100" })]);
    const result = evaluate(setup, day(), [], shiftInputs(setup, d));
    const cards = todaySections(setup, day(), [], result, d);
    expect(cards.map((c) => [c.key, c.subtitle, c.status])).toEqual([
      ["openingDip", "To do · 2 tanks", "todo"],
      ["tanker", "Coming soon", "todo"],
      ["shiftA", "1 of 3 nozzles", "inProgress"],
      ["shiftB", "After Shift A · 2 PM to 10 PM", "todo"],
      ["shiftC", "After Shift B · 10 PM to 6 AM", "todo"],
      ["sales", "Coming soon", "todo"],
      ["expenses", "Coming soon", "todo"],
      ["closingDip", "Coming soon", "todo"],
    ]);
    const done = data(
      [line("A", "hsd3", { opening: "1000", closing: "1100" }), line("A", "hsd4", { opening: "2000", closing: "2050" }), line("A", "ms3", { opening: "500", closing: "520.5" })],
      { attendants: [{ id: "x", shiftId: "A", staffId: "s" }] },
    );
    const r2 = evaluate(setup, day(), [], shiftInputs(setup, done));
    const [, , a, b] = todaySections(setup, day(), [], r2, done);
    expect([a.subtitle, a.status, b.subtitle]).toEqual(["Done · 170.50 L sold", "done", "To do · 2 PM to 10 PM"]);
  });
});
