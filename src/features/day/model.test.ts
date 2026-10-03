import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, type DayResult } from "@/calc";
import { Decimal } from "@/lib/decimal";
import { reviewCard, reviewModel, sectionFor, customerPaymentInputs, daysNotSubmitted, evaluate, expenseInputs, expensesSection, expenseTotals, paidFromLabel, shiftNow, lastPrices, priceRowFor, salesSection, openingOf, priceStrip, sectionsDone, shiftInputs, shiftProgress, tankDays, tankerInputs, tankerSection, todaySections } from "./model";
import type { Day, DaySetup, ExpenseRow, NozzleLine, Receipt, SalesData, SalesSetup, ShiftData, TankReading } from "./queries";

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
  priceRows: [
    { id: "p1", product: "MS", perLitre: "110.07", startsOn: "2026-09-15", margin: null },
    { id: "p2", product: "HSD", perLitre: "101.74", startsOn: "2026-09-15", margin: "2.60" },
  ],
  expenseTypes: [
    { id: "tiffin", name: "Tiffin", defaultType: "VARIABLE", dailyCap: null, uses: 0 },
    { id: "salary", name: "Salary", defaultType: "FIXED", dailyCap: null, uses: 0 },
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
  isMatched: null,
  submittedAt: null,
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

  it("shows every section locked on a locked day; the dips open, the rest wait for their data", () => {
    const result = evaluate(setup, day({ isLocked: true }), []);
    const sections = todaySections(setup, day({ isLocked: true }), [], result);
    expect(sections).toHaveLength(8);
    expect(sections.every((s) => s.status === "locked")).toBe(true);
    expect(sections.filter((s) => s.ready).map((s) => s.key)).toEqual(["openingDip", "closingDip"]);
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
    { id: "A", code: "A", startsAt: "2026-10-01T00:30:00Z", endsAt: "2026-10-01T08:30:00Z", openingCash: null, salesDoneAt: null },
    { id: "B", code: "B", startsAt: "2026-10-01T08:30:00Z", endsAt: "2026-10-01T16:30:00Z", openingCash: null, salesDoneAt: null },
    { id: "C", code: "C", startsAt: "2026-10-01T16:30:00Z", endsAt: "2026-10-02T00:30:00Z", openingCash: null, salesDoneAt: null },
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
      ["closingDip", "To do · 2 tanks", "todo"],
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

describe("tanker (slice 4c)", () => {
  const receipt = (id: string, over: Partial<Receipt> = {}): Receipt => ({
    id,
    dayId: "d",
    businessDate: "2026-10-01",
    vehicleNo: "OD02CD9087",
    invoiceNo: null,
    invoiceDate: null,
    invoiceAmount: null,
    lines: [
      { id: `${id}-h`, product: "HSD", tankId: "hsd", orderedLitres: "14000.00", shortLitres: "28.00", pricePerLitre: "99.14", marginPerLitre: "2.60", dipBeforeCm: null, dipAfterCm: null, chambers: [] },
      { id: `${id}-m`, product: "MS", tankId: "ms", orderedLitres: "4000.00", shortLitres: "20.00", pricePerLitre: null, marginPerLitre: null, dipBeforeCm: null, dipAfterCm: null, chambers: [] },
    ],
    ...over,
  });

  it("feeds the engine: received = ordered − short, and S6 when the short is more than usual", () => {
    const result = evaluate(setup, day(), [], [], tankerInputs([receipt("t1")]));
    expect(result.tankers[0].lines.map((l) => l.receivedNetLitres.toFixed(2))).toEqual(["13972.00", "3980.00"]);
    expect(result.tankers[0].toPay).toBeNull(); // petrol has no price yet
    expect(result.flags.map((f) => `${f.code}:${f.where?.product}`)).toEqual(["S6:MS"]);
  });

  it("is always done: with a tanker it names it (and counts S6 flags), without one it says no tanker came", () => {
    const result = evaluate(setup, day(), [], [], tankerInputs([receipt("t1")]));
    expect(tankerSection(day(), [receipt("t1")], result)).toMatchObject({ status: "done", subtitle: "Done · OD02CD9087", flags: 1 });
    const empty = evaluate(setup, day(), [], []);
    expect(tankerSection(day(), [], empty)).toMatchObject({ status: "done", subtitle: "No tanker today" });
  });

  it("prefills price and margin from the last tanker of each fuel, never from the one being edited", () => {
    const newer = receipt("t2");
    const older = receipt("t1", {
      lines: [{ id: "x", product: "MS", tankId: "ms", orderedLitres: "4000", shortLitres: "0", pricePerLitre: "96.10", marginPerLitre: "4.90", dipBeforeCm: null, dipAfterCm: null, chambers: [] }],
    });
    expect(lastPrices([newer, older])).toEqual({ HSD: { price: "99.14", margin: "2.60" }, MS: { price: "96.10", margin: "4.90" } });
    expect(lastPrices([newer, older], "t2")).toEqual({ MS: { price: "96.10", margin: "4.90" } });
  });
});

describe("sales (slice 4d)", () => {
  const shiftA = { id: "A", code: "A", startsAt: "2026-10-01T00:30:00Z", endsAt: "2026-10-01T08:30:00Z", openingCash: null, salesDoneAt: null };
  const salesSetup: SalesSetup = {
    types: [
      { id: "cash", name: "Cash", kind: "CASH" },
      { id: "xp", name: "XtraPower", kind: "OTHER" },
      { id: "bank", name: "Bank transfer", kind: "OTHER" },
      { id: "credit", name: "Credit", kind: "CREDIT" },
    ],
    notes: [
      { id: "n500", value: "500.00" },
      { id: "n200", value: "200.00" },
    ],
    customers: [
      { id: "dord", name: "Dord Logistics", isActive: true, uses: 0 },
      { id: "maa", name: "Maa Bhawani Roadlines", isActive: true, uses: 0 },
    ],
  };
  // MS 100 L at ₹110.07 = ₹11,007 should have.
  const shiftData: ShiftData = {
    shifts: [shiftA],
    lines: [
      { shiftId: "A", nozzleId: "ms3", readingId: "r", version: 1, opening: "500", openingTyped: true, closing: "600", meterChange: "NONE", hasPrevious: false, previousClosing: null },
    ],
    attendants: [],
    tests: [],
  };
  const sales = (over: Partial<SalesData> = {}): SalesData => ({
    // Cash 10 × ₹500 + 5 × ₹200 + ₹7 coins = ₹6,007; XtraPower ₹8,000 of which ₹3,000 is Dord's dues.
    payments: [
      { id: "p1", shiftId: "A", typeId: "cash", amount: null, coins: "7" },
      { id: "p2", shiftId: "A", typeId: "xp", amount: "8000", coins: null },
    ],
    counts: [
      { id: "c1", shiftId: "A", noteId: "n500", count: 10 },
      { id: "c2", shiftId: "A", noteId: "n200", count: 5 },
    ],
    slips: [],
    customerPayments: [
      { id: "cp1", shiftId: "A", customerId: "dord", typeId: "xp", amount: "3000" },
      { id: "cp2", shiftId: null, customerId: "maa", typeId: "bank", amount: "50000" },
    ],
    money: [{ shiftId: "A", openingCash: "0" }],
    ...over,
  });

  const run = (data: SalesData, d = day({ priceConfirmed: true, confirmed: { MS: "110.07", HSD: "101.74" } })) => {
    const bundle = { setup: salesSetup, data };
    return evaluate(setup, d, [], shiftInputs(setup, shiftData, {}, bundle), [], customerPaymentInputs(shiftData.shifts, bundle));
  };

  it("works out Received the engine's way: cash notes + coins, XtraPower, less dues held in it; bank dues untouched (D47)", () => {
    const m = run(sales()).shifts[0];
    expect(m.shouldHave.toFixed(2)).toBe("11007.00");
    expect(m.receivedParts.cashCounted.toFixed(2)).toBe("6007.00");
    expect(m.receivedParts.customerPaymentsTakenOff.toFixed(2)).toBe("3000.00");
    expect(m.received.toFixed(2)).toBe("11007.00");
    expect(m.difference.isZero()).toBe(true);
  });

  it("takes off the drawer cash at the start (the database's D46 value, or the typed one)", () => {
    expect(run(sales({ money: [{ shiftId: "A", openingCash: "1000" }] })).shifts[0].difference.toFixed(2)).toBe("-1000.00");
  });

  it("works nothing out until the cash is counted", () => {
    expect(run(sales({ payments: [], counts: [] })).shifts).toEqual([]);
  });

  it("gives bank-transfer dues no shift", () => {
    const cps = customerPaymentInputs(shiftData.shifts, { setup: salesSetup, data: sales() });
    expect(cps).toEqual([
      { customer: "Dord Logistics", rupees: "3000", method: "XtraPower", shift: "A" },
      { customer: "Maa Bhawani Roadlines", rupees: "50000", method: "Bank transfer" },
    ]);
  });

  it("shows the Sales card: done when every shift is Done, with how each shift stands", () => {
    const result = run(sales({ payments: [{ id: "p1", shiftId: "A", typeId: "cash", amount: null, coins: "7" }] }));
    expect(salesSection(day(), [shiftA], result, sales()).subtitle).toBe("A short −₹8,000");
    const doneShift = { ...shiftA, salesDoneAt: "2026-10-01T09:00:00Z" };
    const matched = run(sales());
    expect(salesSection(day(), [doneShift], matched, sales())).toMatchObject({ status: "done", subtitle: "Done · A matched", flags: 0 });
    expect(salesSection(day(), [shiftA], matched, sales({ payments: [], counts: [], slips: [] })).subtitle).toBe(
      "To do · Cash, Paytm, Card, XtraPower, Bank, Credit",
    );
  });
});

describe("margin with the price (D64)", () => {
  it("uses the price row in force on the day, with the owner's margin", () => {
    expect(priceRowFor(setup, "HSD", "2026-10-01")).toMatchObject({ id: "p2", margin: "2.60" });
    expect(priceRowFor(setup, "MS", "2026-10-01")?.margin).toBeNull();
    expect(priceRowFor(setup, "HSD", "2026-09-01")).toBeNull();
    const later = { ...setup, priceRows: [...setup.priceRows, { id: "p3", product: "HSD" as const, perLitre: "102.00", startsOn: "2026-10-01", margin: null }] };
    expect(priceRowFor(later, "HSD", "2026-10-01")?.id).toBe("p3");
    expect(priceRowFor(later, "HSD", "2026-09-30")?.id).toBe("p2");
  });
});

describe("expenses (slice 4e)", () => {
  const rows: ExpenseRow[] = [
    { id: "e1", typeId: "tiffin", description: null, amount: "450", paidFrom: "SHIFT_B", customerId: null },
    { id: "e2", typeId: "salary", description: null, amount: "18000", paidFrom: "OWNER", customerId: null },
  ];

  it("gives the engine each expense with its type's name", () => {
    expect(expenseInputs(setup, rows)).toEqual([
      { id: "e1", type: "Tiffin", rupees: "450", paidFrom: "SHIFT_B" },
      { id: "e2", type: "Salary", rupees: "18000", paidFrom: "OWNER" },
    ]);
  });

  it("totals from shift cash and by owner or bank, and says where each came from", () => {
    const t = expenseTotals(rows);
    expect([t.fromShifts.toString(), t.byOwnerOrBank.toString(), t.total.toString()]).toEqual(["450", "18000", "18450"]);
    expect(rows.map((r) => paidFromLabel(r.paidFrom))).toEqual(["From Shift B cash", "Paid by owner"]);
    expect(paidFromLabel("BANK")).toBe("Paid by bank");
  });

  it("is done with an expense or with No expenses today", () => {
    const result = evaluate(setup, day(), []);
    expect(expensesSection(day(), [], result)).toMatchObject({ status: "todo" });
    expect(expensesSection(day({ noExpenses: true }), [], result)).toMatchObject({ status: "done", subtitle: "Done · No expenses today" });
    expect(expensesSection(day(), rows, result)).toMatchObject({ status: "done", subtitle: "Done · ₹18,450" });
  });

  it("adds drawer expenses back to that shift's money", () => {
    const withCap = { ...setup, rules: { ...setup.rules, expenseDailyCaps: { Tiffin: "300" } } };
    const result = evaluate(withCap, day(), [], [], [], [], expenseInputs(setup, rows));
    expect(result.flags.map((f) => f.code)).toContain("S9");
  });

  it("picks the shift running now for Paid from", () => {
    const shifts = (["A", "B", "C"] as const).map((code, i) => ({
      id: code,
      code,
      startsAt: new Date(Date.UTC(2026, 9, 1, 0, 30) + i * 8 * 3600_000).toISOString(),
      endsAt: new Date(Date.UTC(2026, 9, 1, 8, 30) + i * 8 * 3600_000).toISOString(),
      openingCash: null,
      salesDoneAt: null,
    }));
    expect(shiftNow(shifts, Date.UTC(2026, 9, 1, 10))).toBe("SHIFT_B");
    expect(shiftNow(shifts, Date.UTC(2026, 9, 1, 20))).toBe("SHIFT_C");
    expect(shiftNow(shifts, Date.UTC(2026, 9, 3))).toBe("SHIFT_C");
    expect(shiftNow(shifts, Date.UTC(2026, 8, 1))).toBe("SHIFT_A");
  });
});

describe("review and submit (slice 4f)", () => {
  const D = (v: string) => new Decimal(v);
  const result = (over: Partial<DayResult> = {}): DayResult => ({
    prices: { HSD: D("90"), MS: D("101") },
    products: [
      { product: "HSD", openingDipLitres: D("14820"), receivedLitres: D("11980"), closingDipLitres: D("18681"), soldAsPerTank: D("8119"), meterLitres: D("8087"), testLitres: D("10"), soldAsPerMeters: D("8077"), difference: D("-42"), differencePercent: D("-0.517"), withinLimit: false },
      { product: "MS", openingDipLitres: D("8235"), receivedLitres: D("3980"), closingDipLitres: D("9303"), soldAsPerTank: D("2912"), meterLitres: D("2912"), testLitres: D("0"), soldAsPerMeters: D("2912"), difference: D("0"), differencePercent: D("0"), withinLimit: true },
    ],
    shifts: (["A", "B", "C"] as const).map((shift, i) => ({
      shift,
      litres: { MS: D("0"), HSD: D("0") },
      shouldHave: D("1000"),
      received: D(["1000", "-250", "1300"][i]).plus(i === 1 ? 0 : 0),
      receivedParts: { cashCounted: D("0"), openingCash: D("0"), otherPayments: [], creditSlips: D("0"), drawerExpenses: D("0"), customerPaymentsTakenOff: D("0") },
      difference: D(["0", "-1250", "300"][i]),
      withinLimit: i === 0,
    })),
    tankers: [],
    hardErrors: [],
    flags: [
      { code: "S1", severity: "soft", message: "Diesel short 42 L (0.52%): tank vs meters. The owner will see this." },
      { code: "S2", severity: "soft", message: "Shift B short ₹1,250. The owner will see this.", where: { shift: "B" } },
      { code: "S2", severity: "soft", message: "Shift C excess ₹300. The owner will see this.", where: { shift: "C" } },
      { code: "S3", severity: "soft", message: "Opening dip 80 L below IOCL. The owner will see this." },
    ],
    isMatched: false,
    ...over,
  });
  const done = (keys: string[] = []) =>
    (["openingDip", "tanker", "shiftA", "shiftB", "shiftC", "sales", "expenses", "closingDip"] as const).map((key) => ({
      key,
      title: key,
      subtitle: "",
      status: keys.includes(key) ? ("todo" as const) : ("done" as const),
      errors: 0,
      flags: 0,
      ready: true,
    }));
  const receipt = [{ id: "r" }] as unknown as Receipt[];

  it("builds the canvas F8 review: fuel limit in litres and rupees, day total, owner's message", () => {
    const r = reviewModel(setup, day({ priceConfirmed: true }), result(), done(), receipt);
    expect(r.fuels[0].note).toBe("About ₹3,780 · limit is 40.60 L (0.5%)");
    expect(r.dayTotal?.toString()).toBe("-950");
    expect(r.ownerMessage).toBe("01 Oct submitted. Diesel short 42 L, Shift B short ₹1,250, Shift C excess ₹300, 1 more flag");
    expect(r.canSubmit).toBe(true);
  });

  it("sorts the summary into red (must fix), yellow (minor, owner sees) and green (passed)", () => {
    const r = reviewModel(setup, day({ priceConfirmed: true }), result(), done(), receipt);
    expect(r.red).toEqual([]);
    expect(r.yellow.map((l) => [l.text, l.target])).toEqual([
      ["Diesel short 42 L (0.52%): tank vs meters.", "closingDip"],
      ["Shift B short ₹1,250.", "sales"],
      ["Shift C excess ₹300.", "sales"],
      ["Opening dip 80 L below IOCL.", "openingDip"],
    ]);
    expect(r.green.map((l) => l.text)).toEqual([
      "Today's price confirmed",
      "All 8 sections done",
      "Petrol: tank and meters agree (within 0.5%)",
      "Shift A money matched (within ₹100)",
      "Tanker received as per challan",
      "No meter change waiting",
    ]);
  });

  it("says Day matched when nothing is off, and 'Nothing sold' instead of a 0 L limit", () => {
    const quiet = result({ flags: [], shifts: [] });
    const r = reviewModel(setup, day({ priceConfirmed: true }), { ...quiet, products: [] }, done(), receipt);
    expect(r.ownerMessage).toBe("01 Oct submitted. Day matched.");
    const zero = { ...quiet.products[1], soldAsPerTank: D("0"), soldAsPerMeters: D("0"), difference: D("0") };
    expect(reviewModel(setup, day({ priceConfirmed: true }), { ...quiet, products: [zero] }, done(), receipt).fuels[0].note).toBe("Nothing sold today");
  });

  it("red: a section not done (in plain words), a red box, no price, a locked day; the tanker question", () => {
    const ok = day({ priceConfirmed: true });
    const shifts = (["A", "B", "C"] as const).map((code) => ({ id: code, code, startsAt: "", endsAt: "", openingCash: null, salesDoneAt: code === "C" ? null : "x" }));
    const salesOpen = done(["sales"]).map((x) => (x.key === "sales" ? { ...x, title: "Sales" } : x));
    expect(reviewModel(setup, ok, result(), salesOpen, receipt, shifts)).toMatchObject({ red: [{ text: "Sales: tap Done on Shift C", target: "sales" }], canSubmit: false });
    const h8 = result({ hardErrors: [{ code: "H8", severity: "hard", message: "HSD-3: 12 L tested…", where: { shift: "B" } }] });
    expect(reviewModel(setup, ok, h8, done(), receipt)).toMatchObject({ canSubmit: false, red: [{ text: "HSD-3: 12 L tested…", target: "shiftB" }] });
    expect(reviewModel(setup, day(), result(), done(), receipt).red).toEqual([{ text: "Confirm today's price on Today", target: "today" }]);
    expect(reviewModel(setup, day({ priceConfirmed: true, isLocked: true }), result(), done(), receipt).canSubmit).toBe(false);
    expect(reviewModel(setup, ok, result(), done(), [])).toMatchObject({ askNoTanker: true, canSubmit: false });
    expect(reviewModel(setup, day({ priceConfirmed: true, noTanker: true }), result(), done(), [])).toMatchObject({ askNoTanker: false, canSubmit: true });
  });

  it("the last card on Today opens Review and says what's left", () => {
    expect(reviewCard(day(), 8).subtitle).toBe("Confirm the price first");
    expect(reviewCard(day({ priceConfirmed: true }), 6)).toEqual({ subtitle: "Finish 2 more sections first", status: "todo" });
    expect(reviewCard(day({ priceConfirmed: true }), 8).status).toBe("inProgress");
    expect(reviewCard(day({ status: "SUBMITTED", isMatched: true }), 8)).toMatchObject({ status: "done" });
  });

  it("sends each issue to the place to check it", () => {
    expect(sectionFor({ code: "S6", severity: "soft", message: "" })).toBe("tanker");
    expect(sectionFor({ code: "S9", severity: "soft", message: "" })).toBe("expenses");
    expect(sectionFor({ code: "H6", severity: "hard", message: "" })).toBe("today");
    expect(sectionFor({ code: "H3", severity: "hard", message: "HSD-1 closing dip is outside" })).toBe("closingDip");
    expect(sectionFor({ code: "H1", severity: "hard", message: "", where: { shift: "C" } })).toBe("shiftC");
  });
});

describe("tanker finished the next day (D97)", () => {
  const receipt = (nextDay: boolean): Receipt => ({
    id: "r",
    dayId: "d0",
    businessDate: "2026-09-30",
    vehicleNo: "OD02CD9087",
    invoiceNo: null,
    invoiceDate: null,
    invoiceAmount: null,
    lines: [
      {
        id: "l",
        product: "HSD",
        tankId: "hsd",
        orderedLitres: "6000",
        shortLitres: "0",
        pricePerLitre: null,
        marginPerLitre: null,
        dipBeforeCm: null,
        dipAfterCm: null,
        chambers: [
          { litres: "4000", dipBeforeCm: "50.0", dipAfterCm: "80.0", nextDay: false },
          { litres: "2000", dipBeforeCm: "80.0", dipAfterCm: "95.0", nextDay },
        ],
      },
    ],
  });

  it("passes the next-day chambers to the engine", () => {
    expect(tankerInputs([receipt(true)])[0].lines[0].chambers?.map((c) => Boolean(c.nextDay))).toEqual([false, true]);
  });

  it("Today's Tanker card on the next day says what came from yesterday's tanker", () => {
    const result = evaluate(setup, day(), []);
    expect(tankerSection(day(), [], result, [receipt(true)]).subtitle).toBe("Done · 2,000 L from yesterday's OD02CD9087");
    expect(tankerSection(day(), [], result, []).subtitle).toBe("No tanker today");
  });
});
