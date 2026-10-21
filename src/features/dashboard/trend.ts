/**
 * Dashboard › Fuel trend (D109, D113): the last 30 business days per fuel, from the database's
 * v_day_match (the final truth, hard rule 4), so it shows what Review showed. Pure: no React.
 *
 * Sign rule (hard rule 8): Difference = sold as per meters − sold as per tank; negative = short.
 * Only submitted days count in the month total; the others show "not submitted".
 */

import type { Product } from "@/calc";
import { addDays } from "@/lib/businessDay";
import { Decimal, toDecimal } from "@/lib/decimal";

export const TREND_DAYS = 30;

export type TrendDay = { id: string; date: string; status: "DRAFT" | "SUBMITTED" | "LOCKED"; price: Partial<Record<Product, string>> };
export type TrendMatch = {
  dayId: string;
  product: Product;
  soldAsPerTank: string | null;
  soldAsPerMeters: string;
  difference: string | null;
  withinLimit: boolean | null;
};

export type TrendCell = {
  product: Product;
  soldAsPerTank: string | null;
  soldAsPerMeters: string;
  /** Null while the dips aren't both in. */
  difference: string | null;
  /** About ₹ (difference × the day's confirmed price), when both are known. */
  rupees: string | null;
  withinLimit: boolean | null;
};
export type TrendRow = { dayId: string; date: string; submitted: boolean; cells: TrendCell[] };
export type MonthTotal = { product: Product; difference: string; soldAsPerTank: string; percent: string | null; rupees: string; days: number };
export type Trend = { rows: TrendRow[]; month: MonthTotal[]; monthLabel: string };

const FUELS: Product[] = ["HSD", "MS"];

/** First business date of the 30-day window ending on `today`. */
export function trendFrom(today: string): string {
  return addDays(today, -(TREND_DAYS - 1));
}

export function buildTrend(days: TrendDay[], matches: TrendMatch[], today: string): Trend {
  const from = trendFrom(today);
  const month = today.slice(0, 7);
  const rows: TrendRow[] = days
    .filter((d) => d.date >= from && d.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((d) => {
      const submitted = d.status !== "DRAFT";
      const cells = FUELS.flatMap((product) => {
        const m = matches.find((x) => x.dayId === d.id && x.product === product);
        if (!m) return [];
        const price = d.price[product];
        const rupees = m.difference !== null && price ? toDecimal(m.difference).times(price).toFixed(2) : null;
        return [{ product, soldAsPerTank: m.soldAsPerTank, soldAsPerMeters: m.soldAsPerMeters, difference: m.difference, rupees, withinLimit: m.withinLimit }];
      });
      return { dayId: d.id, date: d.date, submitted, cells };
    });

  const totals: MonthTotal[] = FUELS.flatMap((product) => {
    let diff = new Decimal(0);
    let tank = new Decimal(0);
    let rupees = new Decimal(0);
    let count = 0;
    for (const r of rows) {
      if (!r.submitted || !r.date.startsWith(month)) continue;
      const c = r.cells.find((x) => x.product === product);
      if (!c || c.difference === null || c.soldAsPerTank === null) continue;
      diff = diff.plus(c.difference);
      tank = tank.plus(c.soldAsPerTank);
      if (c.rupees) rupees = rupees.plus(c.rupees);
      count += 1;
    }
    if (count === 0) return [];
    return [{ product, difference: diff.toFixed(2), soldAsPerTank: tank.toFixed(2), percent: tank.isZero() ? null : diff.times(100).dividedBy(tank).toFixed(2), rupees: rupees.toFixed(2), days: count }];
  });

  return { rows, month: totals, monthLabel: monthName(month) };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthName(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

// ─── Bars for the chart (owner, 21 Oct: a picture of the trend, details on tap) ──────────
/** loss = red, excess = amber, matched = green (sign rule); notSubmitted = grey; empty = no bar. */
export type BarTone = "loss" | "excess" | "matched" | "notSubmitted" | "empty";
export type TrendBar = { date: string; dayId: string | null; submitted: boolean; cell: TrendCell | null; tone: BarTone };

/** One bar per business day of the window, oldest first (left) to today (right), for one fuel. */
export function trendBars(trend: Trend, product: Product, today: string): TrendBar[] {
  const out: TrendBar[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const row = trend.rows.find((r) => r.date === date);
    const cell = row?.cells.find((c) => c.product === product) ?? null;
    let tone: BarTone = "empty";
    if (row && cell && cell.difference !== null) {
      const d = toDecimal(cell.difference);
      if (!row.submitted) tone = "notSubmitted";
      else if (cell.withinLimit || d.isZero()) tone = "matched";
      else tone = d.isNegative() ? "loss" : "excess";
    }
    out.push({ date, dayId: row?.dayId ?? null, submitted: row?.submitted ?? false, cell, tone });
  }
  return out;
}

/** The day to show under the chart at first: the newest day that has a Difference. */
export function latestWithDifference(bars: TrendBar[]): string | null {
  for (let i = bars.length - 1; i >= 0; i--) if (bars[i].tone !== "empty") return bars[i].date;
  return null;
}
