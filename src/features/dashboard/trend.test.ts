import { describe, expect, it } from "vitest";
import { buildTrend, trendFrom, type TrendDay, type TrendMatch } from "./trend";

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
