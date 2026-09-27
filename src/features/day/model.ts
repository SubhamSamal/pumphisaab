/**
 * Turns what's saved for a day into what the Today screen shows: the engine's input, the 8
 * section cards and the "submit yesterday first" warnings. Pure functions, no React, no Supabase,
 * so they are tested directly (model.test.ts).
 */

import { evaluateDay, priceFor, type DayInput, type DayResult, type Issue, type Product, type TankDay } from "@/calc";
import { addDays } from "@/lib/businessDay";
import { toDecimal } from "@/lib/decimal";
import { fmtRupees } from "@/lib/format";
import type { SectionStatus } from "@/components/ui";
import type { Day, DaySetup, DayStatus, TankReading, TankYesterday } from "./queries";

/**
 * What's typed on screen right now for a tank, before or after it is saved.
 * undefined = use what's saved; null = the box is empty (or not a valid number yet).
 */
export type TypedTank = { openingDipCm?: string | null; closingDipCm?: string | null; bookStockLitres?: string | null };

const pick = (typed: string | null | undefined, saved: string | null | undefined): string | undefined =>
  typed === undefined ? (saved ?? undefined) : (typed ?? undefined);

export function activeTanks(setup: DaySetup) {
  return setup.tanks.filter((t) => t.isActive);
}

/** Saved readings, overlaid with anything typed but not yet saved, as the engine wants them. */
export function tankDays(
  setup: DaySetup,
  readings: TankReading[],
  yesterday: TankYesterday[],
  typed: Record<string, TypedTank> = {},
): TankDay[] {
  const out: TankDay[] = [];
  for (const tank of activeTanks(setup)) {
    const opening = readings.find((r) => r.tankId === tank.id && r.type === "OPENING");
    const closing = readings.find((r) => r.tankId === tank.id && r.type === "CLOSING");
    const y = yesterday.find((r) => r.tankId === tank.id);
    const t = typed[tank.id] ?? {};
    const openingDipCm = pick(t.openingDipCm, opening?.dipCm);
    if (openingDipCm === undefined) continue; // the engine needs an opening dip for a tank
    const closingDipCm = pick(t.closingDipCm, closing?.dipCm);
    const book = pick(t.bookStockLitres, opening?.bookStockLitres);
    out.push({
      tankId: tank.id,
      openingDipCm,
      ...(closingDipCm !== undefined ? { closingDipCm } : {}),
      ...(book !== undefined ? { bookStockLitres: book } : {}),
      ...(y?.closingDipCm ? { yesterdayClosingDipCm: y.closingDipCm } : {}),
      ...(y?.bookGapLitres ? { yesterdayBookGapLitres: y.bookGapLitres } : {}),
    });
  }
  return out;
}

/** Everything known about the day so far, through the calculation engine (src/calc). */
export function evaluate(setup: DaySetup, day: Day, days: TankDay[]): DayResult {
  const input: DayInput = {
    businessDate: day.businessDate,
    priceConfirmed: day.priceConfirmed,
    prices: setup.prices,
    tanks: activeTanks(setup).map((t) => ({ id: t.id, label: t.label, product: t.product, chart: setup.charts[t.chartId] ?? [] })),
    tankDays: days,
    tankers: [],
    shifts: [],
    expenses: [],
    customerPayments: [],
  };
  return evaluateDay(input, setup.rules);
}

export const issuesForTank = (issues: Issue[], tankId: string) => issues.filter((i) => i.where?.tankId === tankId);

// ─── The 8 sections on Today ──────────────────────────────────────────────
export type SectionKey = "openingDip" | "tanker" | "shiftA" | "shiftB" | "shiftC" | "sales" | "expenses" | "closingDip";
export type Section = {
  key: SectionKey;
  title: string;
  subtitle: string;
  status: SectionStatus;
  errors: number;
  flags: number;
  /** false until its slice is built: the card says so and doesn't open. */
  ready: boolean;
};

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

function dipSection(
  key: "openingDip" | "closingDip",
  title: string,
  setup: DaySetup,
  readings: TankReading[],
  result: DayResult,
  locked: boolean,
): Section {
  const type = key === "openingDip" ? "OPENING" : "CLOSING";
  const tanks = activeTanks(setup);
  const typed = tanks.filter((t) => readings.some((r) => r.tankId === t.id && r.type === type && r.dipCm !== null)).length;
  const codes = key === "openingDip" ? ["S3", "S7"] : [];
  const flags = result.flags.filter((f) => codes.includes(f.code)).length;
  const errors = result.hardErrors.filter((e) => e.code === "H3" && e.message.includes(key === "openingDip" ? "opening" : "closing")).length;
  const status: SectionStatus = locked ? "locked" : typed === tanks.length && tanks.length > 0 ? "done" : typed > 0 ? "inProgress" : "todo";
  const subtitle =
    status === "done" || status === "locked"
      ? `Done · ${plural(tanks.length, "tank")}`
      : typed > 0
        ? `${typed} of ${plural(tanks.length, "tank")}`
        : `To do · ${plural(tanks.length, "tank")}`;
  return { key, title, subtitle, status, errors, flags, ready: key === "openingDip" };
}

const COMING: { key: SectionKey; title: string }[] = [
  { key: "tanker", title: "Tanker" },
  { key: "shiftA", title: "Shift A readings" },
  { key: "shiftB", title: "Shift B readings" },
  { key: "shiftC", title: "Shift C readings" },
  { key: "sales", title: "Sales" },
  { key: "expenses", title: "Expenses" },
];

export function todaySections(setup: DaySetup, day: Day, readings: TankReading[], result: DayResult): Section[] {
  const opening = dipSection("openingDip", "Opening dip", setup, readings, result, day.isLocked);
  const later = COMING.map(
    ({ key, title }): Section => ({ key, title, subtitle: "Coming soon", status: day.isLocked ? "locked" : "todo", errors: 0, flags: 0, ready: false }),
  );
  const closing = { ...dipSection("closingDip", "Closing dip", setup, readings, result, day.isLocked), ready: false, subtitle: "Coming soon" };
  return [opening, ...later, closing];
}

export const sectionsDone = (sections: Section[]) => sections.filter((s) => s.status === "done").length;

// ─── "Submit yesterday first" (D3) and the not-submitted warnings (D49) ────
/**
 * Yesterday and the day before, if not submitted (or never started), newest first. Only days from
 * the pump's first day in the app count, so old notebook days never warn.
 */
export function daysNotSubmitted(
  today: string,
  firstBusinessDate: string | null,
  recent: { business_date: string; status: DayStatus }[],
): string[] {
  const out: string[] = [];
  for (const back of [1, 2]) {
    const date = addDays(today, -back);
    if (firstBusinessDate && date < firstBusinessDate) continue;
    if (!firstBusinessDate) continue;
    const row = recent.find((r) => r.business_date === date);
    if (!row || row.status === "DRAFT") out.push(date);
  }
  return out;
}

// ─── Price Confirm strip (H6) ─────────────────────────────────────────────
export type PriceStripModel = {
  state: "toConfirm" | "changed" | "confirmed";
  note?: string;
  items: { product: Product; price: string; was?: string }[];
  /** Fuels with a tank but no price for this day: the owner must add one. */
  missing: Product[];
};

/**
 * What the strip shows. First confirm of the day: "Same as yesterday", or "New price from today"
 * with yesterday's price beside it. If the owner adds a price for this day after it was confirmed,
 * the strip asks again, showing the price that was confirmed.
 */
export function priceStrip(setup: DaySetup, day: Day): PriceStripModel {
  const fuels = [...new Set(activeTanks(setup).map((t) => t.product))].sort((a, b) => (a === "HSD" ? -1 : b === "HSD" ? 1 : 0));
  const missing = fuels.filter((f) => !day.now[f]);
  const money = (v: string) => fmtRupees(v, "input");

  if (day.priceConfirmed) {
    return { state: "confirmed", missing, items: fuels.filter((f) => day.confirmed[f]).map((f) => ({ product: f, price: money(day.confirmed[f] as string) })) };
  }

  const reconfirm = Object.keys(day.confirmed).length > 0;
  const before = (f: Product): string | undefined => {
    if (reconfirm) return day.confirmed[f];
    return priceFor(setup.prices, f, addDays(day.businessDate, -1))?.toFixed(2);
  };
  const items = fuels
    .filter((f) => day.now[f])
    .map((f) => {
      const now = day.now[f] as string;
      const was = before(f);
      const changed = was !== undefined && !toDecimal(was).equals(toDecimal(now));
      return { product: f, price: money(now), ...(changed ? { was: money(was) } : {}) };
    });
  const anyChanged = items.some((i) => i.was);
  return anyChanged
    ? { state: "changed", note: "Set by owner", items, missing }
    : { state: "toConfirm", note: !reconfirm && fuels.every((f) => before(f) !== undefined) ? "Same as yesterday" : undefined, items, missing };
}
