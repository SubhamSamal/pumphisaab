import { describe, expect, it } from "vitest";
import { buildTrend, groupNozzleChecks, latestWithDifference, trendBars, trendFrom, type NozzleCheckRow, type TrendDay, type TrendMatch } from "./trend";

const price = { HSD: "101.74", MS: "110.07" };
const days: TrendDay[] = [
  { id: "d01", date: "2026-10-01", status: "SUBMITTED", price },
  { id: "d02", date: "2026-10-02", status: "SUBMITTED", price },
  { id: "d03", date: "2026-10-03", status: "DRAFT", price: {} },
  { id: "s30", date: "2026-09-30", status: "SUBMITTED", price },
  { id: "old", date: "2026-08-01", status: "SUBMITTED", price },
];
const m = (dayId: string, product: "HSD" | "MS", tank: string | null, meters: string, diff: string | null): TrendMatch => ({
  dayId,
  product,
  soldAsPerTank: tank,
  soldAsPerMeters: meters,
  difference: diff,
  withinLimit: diff === null ? null : false,
});
const matches: TrendMatch[] = [
  // 1 Oct petrol: the real short (385.89 L by tank, 359.31 L by meters).
  m("d01", "MS", "385.89", "359.31", "-26.58"),
  m("d01", "HSD", "9000.00", "8935.00", "-65.00"),
  m("d02", "MS", "250.00", "251.00", "1.00"),
  m("d02", "HSD", "10000.00", "10000.00", "0.00"),
  m("d03", "MS", null, "300.00", null),
  m("s30", "MS", "200.00", "190.00", "-10.00"),
];

describe("fuel trend (D109)", () => {
  it("covers the 30 business days ending today", () => {
    expect(trendFrom("2026-10-20")).toBe("2026-09-21");
  });

  it("lists days newest first, diesel then petrol, with about ₹ from the day's confirmed price", () => {
    const t = buildTrend(days, matches, "2026-10-03");
    expect(t.rows.map((r) => r.date)).toEqual(["2026-10-03", "2026-10-02", "2026-10-01", "2026-09-30"]);
    const oct1 = t.rows.find((r) => r.date === "2026-10-01");
    expect(oct1?.cells.map((c) => c.product)).toEqual(["HSD", "MS"]);
    // −26.58 L × ₹110.07 = −₹2,925.66
    expect(oct1?.cells.find((c) => c.product === "MS")?.rupees).toBe("-2925.66");
  });

  it("a day not submitted shows, but isn't counted; dips not in yet = no Difference", () => {
    const t = buildTrend(days, matches, "2026-10-03");
    const oct3 = t.rows[0];
    expect(oct3.submitted).toBe(false);
    expect(oct3.cells[0].difference).toBeNull();
    expect(oct3.cells[0].rupees).toBeNull();
  });

  it("month total: this month's submitted days only (30 Sep and 3 Oct left out)", () => {
    const t = buildTrend(days, matches, "2026-10-03");
    expect(t.monthLabel).toBe("Oct 2026");
    const ms = t.month.find((x) => x.product === "MS");
    // −26.58 + 1.00 = −25.58 L; tank 385.89 + 250 = 635.89 L → −4.02 %; ₹ −2,925.66 + 110.07 = −2,815.59
    expect(ms).toEqual({ product: "MS", difference: "-25.58", soldAsPerTank: "635.89", percent: "-4.02", rupees: "-2815.59", days: 2 });
    expect(t.month.find((x) => x.product === "HSD")?.difference).toBe("-65.00");
  });

  it("nothing submitted this month: no month total", () => {
    expect(buildTrend(days, matches, "2026-11-01").month).toEqual([]);
  });
});

describe("trend bars (chart)", () => {
  const t = buildTrend(days, matches, "2026-10-03");
  const bars = trendBars(t, "MS", "2026-10-03");

  it("one bar per day of the 30-day window, oldest on the left, today on the right", () => {
    expect(bars).toHaveLength(30);
    expect(bars[0].date).toBe("2026-09-04");
    expect(bars[29].date).toBe("2026-10-03");
  });

  it("colours follow the sign rule; not submitted is grey; no dips or no day = no bar", () => {
    const tone = (date: string) => bars.find((b) => b.date === date)?.tone;
    expect(tone("2026-10-01")).toBe("loss"); // −26.58 L
    expect(tone("2026-10-02")).toBe("excess"); // +1 L, beyond the limit
    expect(tone("2026-10-03")).toBe("empty"); // dips not in yet
    expect(tone("2026-09-29")).toBe("empty"); // no day at all
    const withinLimit = trendBars(buildTrend(days, [{ ...matches[0], withinLimit: true }], "2026-10-03"), "MS", "2026-10-03");
    expect(withinLimit.find((b) => b.date === "2026-10-01")?.tone).toBe("matched");
    const draft = trendBars(buildTrend([{ ...days[0], status: "DRAFT" }], [matches[0]], "2026-10-03"), "MS", "2026-10-03");
    expect(draft.find((b) => b.date === "2026-10-01")?.tone).toBe("notSubmitted");
  });

  it("starts on the newest day that has a Difference", () => {
    expect(latestWithDifference(bars)).toBe("2026-10-02");
    expect(latestWithDifference(trendBars(buildTrend([], [], "2026-10-03"), "MS", "2026-10-03"))).toBeNull();
  });
});

describe("nozzle checks (D110)", () => {
  const row = (over: Partial<NozzleCheckRow>): NozzleCheckRow => ({
    date: "2026-10-20",
    shift: "A",
    nozzleId: "ms3",
    label: "MS-3",
    product: "MS",
    meterLitres: "5.00",
    measuredLitres: "5.25",
    error: "0.25",
    errorPercent: "5.00",
    flagged: true,
    who: "Ramesh",
    ...over,
  });

  it("groups per nozzle, diesel first, newest check first, counting the flagged ones", () => {
    const groups = groupNozzleChecks([
      row({}),
      row({ date: "2026-10-21", flagged: false, measuredLitres: "5.02", error: "0.02", errorPercent: "0.40" }),
      row({ nozzleId: "hsd4", label: "HSD-4", product: "HSD", flagged: false }),
    ]);
    expect(groups.map((g) => g.label)).toEqual(["HSD-4", "MS-3"]);
    expect(groups[1].checks.map((c) => c.date)).toEqual(["2026-10-21", "2026-10-20"]);
    expect(groups[1].flaggedCount).toBe(1);
  });

  it("keeps at most 5 checks per nozzle", () => {
    const many = Array.from({ length: 8 }, (_, i) => row({ date: `2026-10-${String(10 + i).padStart(2, "0")}` }));
    expect(groupNozzleChecks(many)[0].checks).toHaveLength(5);
    expect(groupNozzleChecks(many)[0].flaggedCount).toBe(8);
  });
});
