/**
 * Turns what's saved for a day into what the Today screen shows: the engine's input, the 8
 * section cards and the "submit yesterday first" warnings. Pure functions, no React, no Supabase,
 * so they are tested directly (model.test.ts).
 */

import {
  evaluateDay,
  priceFor,
  shiftLitres,
  type DayInput,
  type DayResult,
  type Expense,
  type Issue,
  type Product,
  type CustomerPayment,
  type ShiftCode,
  type ShiftInput,
  type TankDay,
  type TankerReceipt,
} from "@/calc";
import { addDays } from "@/lib/businessDay";
import { Decimal, toDecimal } from "@/lib/decimal";
import { fmtClock, fmtDate, fmtDifference, fmtLitres, fmtRupees } from "@/lib/format";
import type { SectionStatus } from "@/components/ui";
import type {
  Day,
  DaySetup,
  DayStatus,
  ExpenseRow,
  NozzleLine,
  Receipt,
  SalesData,
  SalesSetup,
  SetupNozzle,
  Shift,
  ShiftData,
  TankReading,
  TankYesterday,
} from "./queries";

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
export function evaluate(
  setup: DaySetup,
  day: Day,
  days: TankDay[],
  shifts: ShiftInput[] = [],
  tankers: TankerReceipt[] = [],
  customerPayments: CustomerPayment[] = [],
  expenses: Expense[] = [],
): DayResult {
  const input: DayInput = {
    businessDate: day.businessDate,
    priceConfirmed: day.priceConfirmed,
    prices: setup.prices,
    tanks: activeTanks(setup).map((t) => ({ id: t.id, label: t.label, product: t.product, chart: setup.charts[t.chartId] ?? [] })),
    tankDays: days,
    tankers,
    shifts,
    expenses,
    customerPayments,
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
  return { key, title, subtitle, status, errors, flags, ready: true };
}

function comingSoon(key: SectionKey, title: string, locked: boolean): Section {
  return { key, title, subtitle: "Coming soon", status: locked ? "locked" : "todo", errors: 0, flags: 0, ready: false };
}

export function todaySections(
  setup: DaySetup,
  day: Day,
  readings: TankReading[],
  result: DayResult,
  shiftData?: ShiftData,
  typed: TypedClosings = {},
  receipts?: Receipt[],
  sales?: SalesBundle,
  expenses?: ExpenseRow[],
): Section[] {
  const opening = dipSection("openingDip", "Opening dip", setup, readings, result, day.isLocked);
  const shiftCards = (["A", "B", "C"] as const).map((code) => {
    const key = `shift${code}` as SectionKey;
    const shift = shiftData?.shifts.find((s) => s.code === code);
    return shift && shiftData ? shiftSection(key, shift, setup, shiftData, result, day.isLocked, typed) : comingSoon(key, `Shift ${code} readings`, day.isLocked);
  });
  const salesCard = sales && shiftData ? salesSection(day, shiftData.shifts, result, sales.data) : comingSoon("sales", "Sales", day.isLocked);
  const expensesCard = expenses ? expensesSection(day, expenses, result) : comingSoon("expenses", "Expenses", day.isLocked);
  const closing = dipSection("closingDip", "Closing dip", setup, readings, result, day.isLocked);
  const tanker = receipts ? tankerSection(day, receipts, result) : comingSoon("tanker", "Tanker", day.isLocked);
  return [opening, tanker, ...shiftCards, salesCard, expensesCard, closing];
}

// ─── Shift meters and testing (slice 4b) ──────────────────────────────────
/**
 * Readings typed on screen but maybe not saved yet: closings by `${shiftId}:${nozzleId}`, and
 * typed openings (first reading, nothing to copy) by `open:${shiftId}:${nozzleId}`. null = empty.
 */
export type TypedClosings = Record<string, string | null>;
export const lineKey = (shiftId: string, nozzleId: string) => `${shiftId}:${nozzleId}`;
export const openingKey = (shiftId: string, nozzleId: string) => `open:${shiftId}:${nozzleId}`;

/** The opening on screen: typed (not yet saved) if there is one, else the saved or copied one. */
function openingShown(line: NozzleLine | undefined, shiftId: string, nozzleId: string, typed: TypedClosings): string | null {
  const key = openingKey(shiftId, nozzleId);
  return key in typed ? typed[key] : openingOf(line);
}

export const inUseNozzles = (setup: DaySetup) => setup.nozzles.filter((n) => n.inUse);

/**
 * The opening a line has, or will have once saved: a typed opening, or the previous shift's
 * closing (the database copies it on save). Null while that closing isn't known.
 */
export function openingOf(line: NozzleLine | undefined): string | null {
  if (!line) return null;
  return line.opening ?? (line.openingTyped ? null : line.previousClosing);
}

/** "6 AM to 2 PM" */
export const shiftHours = (shift: Shift) => `${fmtClock(shift.startsAt)} to ${fmtClock(shift.endsAt)}`;

/** The day's shifts as the engine wants them: readings (with typed closings on top), testing and, once Sales exists, money. */
export function shiftInputs(setup: DaySetup, data: ShiftData, typed: TypedClosings = {}, sales?: SalesBundle): ShiftInput[] {
  return data.shifts.map((shift) => ({
    code: shift.code as ShiftCode,
    nozzles: setup.nozzles.map((n) => {
      const line = data.lines.find((l) => l.shiftId === shift.id && l.nozzleId === n.id);
      const key = lineKey(shift.id, n.id);
      const closing = key in typed ? typed[key] : line?.closing;
      const opening = openingShown(line, shift.id, n.id, typed);
      return {
        nozzleId: n.id,
        label: n.label,
        product: n.product,
        tankId: n.tankId,
        inUse: n.inUse,
        ...(opening ? { opening } : {}),
        ...(closing ? { closing } : {}),
        ...(line?.hasPrevious && line.previousClosing ? { previousClosing: line.previousClosing } : {}),
        ...(line?.meterChange === "APPROVED" ? { meterChangeApproved: true } : {}),
      };
    }),
    tests: data.tests.filter((t) => t.shiftId === shift.id).map((t) => ({ nozzleId: t.nozzleId, litres: t.litres })),
    ...(sales ? shiftMoneyInput(shift, sales) : { openingCash: "0", otherPayments: [], creditSlips: [] }),
  }));
}

// ─── Sales (slice 4d) ─────────────────────────────────────────────────────
export type SalesBundle = { setup: SalesSetup; data: SalesData };

/**
 * One shift's money as the engine wants it. The cash counts as counted once any note or the coins
 * are saved (or Done is tapped). Cash at the start: typed, else what the database worked out from
 * the previous shift's count (D46), else 0.
 */
export function shiftMoneyInput(shift: Shift, { setup, data }: SalesBundle): Pick<ShiftInput, "cash" | "openingCash" | "otherPayments" | "creditSlips"> {
  const cashType = setup.types.find((t) => t.kind === "CASH");
  const cashRow = data.payments.find((p) => p.shiftId === shift.id && p.typeId === cashType?.id);
  const counts = data.counts.filter((c) => c.shiftId === shift.id);
  const customerName = (id: string) => setup.customers.find((c) => c.id === id)?.name ?? "";
  return {
    openingCash: shift.openingCash ?? data.money.find((m) => m.shiftId === shift.id)?.openingCash ?? "0",
    ...(cashRow || counts.length
      ? {
          cash: {
            byNotes: counts.map((c) => ({ noteValue: setup.notes.find((n) => n.id === c.noteId)?.value ?? "0", count: String(c.count) })),
            coins: cashRow?.coins ?? "0",
          },
        }
      : {}),
    otherPayments: setup.types
      .filter((t) => t.kind === "OTHER")
      .flatMap((t) => {
        const row = data.payments.find((p) => p.shiftId === shift.id && p.typeId === t.id);
        return row?.amount != null ? [{ type: t.name, amount: row.amount }] : [];
      }),
    creditSlips: data.slips
      .filter((x) => x.shiftId === shift.id)
      .map((x) => ({
        slipNo: x.slipNo,
        customer: customerName(x.customerId),
        vehicleNo: x.vehicleNo,
        product: x.product,
        entry: x.entryBy === "RUPEES" ? { by: "rupees" as const, rupees: x.rupees } : { by: "litres" as const, litres: x.litres },
      })),
  };
}

/** Payments from customers as the engine wants them; a bank transfer carries no shift (D47). */
export function customerPaymentInputs(shifts: Shift[], { setup, data }: SalesBundle): CustomerPayment[] {
  return data.customerPayments.map((p) => {
    const code = shifts.find((s) => s.id === p.shiftId)?.code;
    return {
      customer: setup.customers.find((c) => c.id === p.customerId)?.name ?? "",
      rupees: p.amount,
      method: setup.types.find((t) => t.id === p.typeId)?.name ?? "",
      ...(code ? { shift: code as ShiftCode } : {}),
    };
  });
}

/** Done when every shift's Sales is marked Done. The line says how each shift stands. */
export function salesSection(day: Day, shifts: Shift[], result: DayResult, data: SalesData): Section {
  const done = shifts.length > 0 && shifts.every((s) => s.salesDoneAt);
  const started = shifts.some((s) => s.salesDoneAt) || data.payments.length > 0 || data.slips.length > 0 || data.counts.length > 0;
  const parts = shifts.map((s) => {
    const m = result.shifts.find((x) => x.shift === s.code);
    if (!m) return `${s.code} open`;
    const d = fmtDifference(m.difference, "rupees");
    return d.tone === "matched" ? `${s.code} matched` : `${s.code} ${d.word.toLowerCase()} ${d.text}`;
  });
  return {
    key: "sales",
    title: "Sales",
    subtitle: started ? `${done ? "Done · " : ""}${parts.join(" · ")}` : "To do · Cash, Paytm, Card, XtraPower, Bank, Credit",
    status: day.isLocked ? "locked" : done ? "done" : started ? "inProgress" : "todo",
    errors: result.hardErrors.filter((e) => e.code === "H9").length,
    flags: result.flags.filter((f) => f.code === "S2").length,
    ready: true,
  };
}

/** Each in-use nozzle's opening and closing are known, and at least one person is ticked. */
export function shiftProgress(shift: Shift, setup: DaySetup, data: ShiftData, typed: TypedClosings = {}) {
  const nozzles = inUseNozzles(setup);
  const lines = nozzles.map((n) => data.lines.find((l) => l.shiftId === shift.id && l.nozzleId === n.id));
  const closingOf = (n: SetupNozzle, i: number) => {
    const key = lineKey(shift.id, n.id);
    return key in typed ? typed[key] : lines[i]?.closing;
  };
  // A reading counts as typed only when it can be true (closing not below opening, H1).
  const typedCount = nozzles.filter((n, i) => {
    const opening = openingShown(lines[i], shift.id, n.id, typed);
    const closing = closingOf(n, i);
    return opening && closing && !new Decimal(closing).lessThan(opening);
  }).length;
  const people = data.attendants.filter((a) => a.shiftId === shift.id).length;
  const started = nozzles.some((n, i) => closingOf(n, i)) || people > 0 || data.tests.some((t) => t.shiftId === shift.id);
  return { typedCount, total: nozzles.length, people, started, done: nozzles.length > 0 && typedCount === nozzles.length && people > 0 };
}

function shiftSection(
  key: SectionKey,
  shift: Shift,
  setup: DaySetup,
  data: ShiftData,
  result: DayResult,
  locked: boolean,
  typed: TypedClosings,
): Section {
  const p = shiftProgress(shift, setup, data, typed);
  const errors = result.hardErrors.filter((e) => e.where?.shift === shift.code && ["H1", "H2", "H8"].includes(e.code)).length;
  const i = data.shifts.findIndex((s) => s.id === shift.id);
  const before = i > 0 ? data.shifts[i - 1] : undefined;
  const beforeDone = !before || shiftProgress(before, setup, data, typed).done;
  const litres = shiftInputs(setup, data, typed)[i];
  const sold = litres ? shiftLitres(litres).soldAsPerMeters : null;
  const total = sold ? sold.MS.plus(sold.HSD) : null;

  const status: SectionStatus = locked ? "locked" : p.done ? "done" : p.started ? "inProgress" : "todo";
  const subtitle = p.done
    ? `Done · ${total ? fmtLitres(total) : "0 L"} sold`
    : p.started
      ? p.typedCount === p.total && p.people === 0
        ? "Tick who worked this shift"
        : `${p.typedCount} of ${plural(p.total, "nozzle")}`
      : `${beforeDone ? "To do" : `After Shift ${before?.code}`} · ${shiftHours(shift)}`;
  return { key, title: `Shift ${shift.code} readings`, subtitle, status, errors, flags: 0, ready: true };
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

// ─── Tanker (slice 4c) ────────────────────────────────────────────────────
/** Saved tankers as the engine wants them. */
export function tankerInputs(receipts: Receipt[]): TankerReceipt[] {
  return receipts.map((r) => ({
    id: r.id,
    vehicleNo: r.vehicleNo,
    ...(r.invoiceNo ? { invoiceNo: r.invoiceNo } : {}),
    ...(r.invoiceAmount ? { invoiceAmount: r.invoiceAmount } : {}),
    lines: r.lines.map((l) => ({
      product: l.product,
      tankId: l.tankId,
      orderedLitres: l.orderedLitres,
      shortLitres: l.shortLitres,
      ...(l.pricePerLitre ? { pricePerLitre: l.pricePerLitre } : {}),
      ...(l.marginPerLitre ? { marginPerLitre: l.marginPerLitre } : {}),
      ...(l.dipBeforeCm ? { dipBeforeCm: l.dipBeforeCm } : {}),
      ...(l.dipAfterCm ? { dipAfterCm: l.dipAfterCm } : {}),
      ...(l.chambers.length
        ? { chambers: l.chambers.map((c) => ({ litres: c.litres, dipAfterCm: c.dipAfterCm, ...(c.dipBeforeCm ? { dipBeforeCm: c.dipBeforeCm } : {}) })) }
        : {}),
    })),
  }));
}

/**
 * Always done (owner, 27 Sep: no "No tanker today" switch): no tanker added simply means none came.
 * The Review before Submit asks once when a day has no tanker (slice 4f). Amber count = S6 flags.
 */
export function tankerSection(day: Day, receipts: Receipt[], result: DayResult): Section {
  const flags = result.flags.filter((f) => f.code === "S6").length;
  const subtitle = receipts.length > 0 ? `Done · ${receipts.map((r) => r.vehicleNo).join(", ")}` : "No tanker today";
  return { key: "tanker", title: "Tanker", subtitle, status: day.isLocked ? "locked" : "done", errors: 0, flags, ready: true };
}

/**
 * Price and margin per litre from the last tanker of each fuel (canvas F4: prefilled, shown as a
 * line to check). `recent` is newest first; the tanker being edited is left out.
 */
export function lastPrices(recent: Receipt[], exceptId?: string): Partial<Record<Product, { price: string | null; margin: string | null }>> {
  const out: Partial<Record<Product, { price: string | null; margin: string | null }>> = {};
  for (const r of recent) {
    if (r.id === exceptId) continue;
    for (const l of r.lines) {
      if (!out[l.product] && (l.pricePerLitre || l.marginPerLitre)) out[l.product] = { price: l.pricePerLitre, margin: l.marginPerLitre };
    }
  }
  return out;
}

/**
 * The price row in force for a fuel on a date (latest start date on or before it), with the dealer
 * margin the owner set on it (D64). Invoice price per litre = selling price − margin.
 */
export function priceRowFor(setup: DaySetup, product: Product, date: string) {
  return (
    setup.priceRows
      .filter((r) => r.product === product && r.startsOn <= date)
      .sort((a, b) => (a.startsOn < b.startsOn ? 1 : -1))[0] ?? null
  );
}

// ─── Expenses (slice 4e) ──────────────────────────────────────────────────
/** Saved expenses as the engine wants them: the type's name (S9 limits are per type). */
export function expenseInputs(setup: DaySetup, rows: ExpenseRow[]): Expense[] {
  return rows.map((e) => ({
    id: e.id,
    type: setup.expenseTypes.find((t) => t.id === e.typeId)?.name ?? "",
    rupees: e.amount,
    paidFrom: e.paidFrom,
  }));
}

/** "From Shift B cash" / "Paid by owner" / "Paid by bank" (canvas F7). */
export const paidFromLabel = (p: ExpenseRow["paidFrom"]) =>
  p === "OWNER" ? "Paid by owner" : p === "BANK" ? "Paid by bank" : `From Shift ${p.slice(-1)} cash`;

/** Totals under the list: from shift cash, paid by owner or bank, total. */
export function expenseTotals(rows: ExpenseRow[]) {
  const sumOf = (list: ExpenseRow[]) => list.reduce((t, e) => t.plus(e.amount), new Decimal(0));
  const fromShifts = sumOf(rows.filter((e) => e.paidFrom.startsWith("SHIFT_")));
  const byOwnerOrBank = sumOf(rows.filter((e) => !e.paidFrom.startsWith("SHIFT_")));
  return { fromShifts, byOwnerOrBank, total: fromShifts.plus(byOwnerOrBank) };
}

/** Done when at least one expense is added or "No expenses today" is tapped (PRD F8). */
export function expensesSection(day: Day, rows: ExpenseRow[], result: DayResult): Section {
  const done = rows.length > 0 || day.noExpenses;
  const subtitle = rows.length > 0 ? `Done · ${fmtRupees(expenseTotals(rows).total)}` : day.noExpenses ? "Done · No expenses today" : "To do · Tiffin, salary, anything paid out";
  return {
    key: "expenses",
    title: "Expenses",
    subtitle,
    status: day.isLocked ? "locked" : done ? "done" : "todo",
    errors: 0,
    flags: result.flags.filter((f) => f.code === "S9").length,
    ready: true,
  };
}

/** The shift running at this moment (for "Paid from"), from the day's shift times; A if none. */
export function shiftNow(shifts: Shift[], nowMs: number): "SHIFT_A" | "SHIFT_B" | "SHIFT_C" {
  const running = shifts.find((s) => Date.parse(s.startsAt) <= nowMs && nowMs < Date.parse(s.endsAt));
  const code = running?.code ?? (shifts.length && nowMs >= Date.parse(shifts[shifts.length - 1].endsAt) ? "C" : "A");
  return `SHIFT_${code}` as "SHIFT_A" | "SHIFT_B" | "SHIFT_C";
}

// ─── Review and submit (slice 4f, canvas F8) ──────────────────────────────
const FUEL_WORD: Record<Product, string> = { HSD: "Diesel", MS: "Petrol" };

/** Where to go to check a flag or fix an error (tap on the Review list). "today" = the Today screen (price). */
export type ReviewTarget = SectionKey | "today";
export function sectionFor(issue: Issue): ReviewTarget {
  switch (issue.code) {
    case "S2":
    case "H7":
    case "H9":
      return "sales";
    case "S3":
    case "S7":
      return "openingDip";
    case "S6":
      return "tanker";
    case "S9":
      return "expenses";
    case "S1":
    case "R1":
      return "closingDip";
    case "H6":
      return "today";
    case "H3":
      return issue.message.toLowerCase().includes("closing") ? "closingDip" : "openingDip";
  }
  return issue.where?.shift ? (`shift${issue.where.shift}` as SectionKey) : "today";
}

export type ReviewFuel = {
  product: Product;
  name: string;
  soldAsPerTank: Decimal;
  soldAsPerMeters: Decimal;
  difference: Decimal;
  withinLimit: boolean;
  /** "About ₹3,780 · limit is 40 L (0.5%)", or "Nothing sold" */
  note: string;
};

/** One line in the Summary (owner, 29 Sep: red must be fixed, yellow can be ignored, green passed). */
export type SummaryLine = { text: string; target?: ReviewTarget };

export type ReviewModel = {
  fuels: ReviewFuel[];
  /** Fuels in use whose check can't be worked out yet (a dip missing). */
  fuelsWaiting: string[];
  shifts: DayResult["shifts"];
  dayTotal: Decimal | null;
  /** Can't submit until these are cleared: sections not done, red boxes, price, lock. */
  red: SummaryLine[];
  /** Minor: the owner sees them, submit is allowed (every flag, S1-S9 and R1). */
  yellow: SummaryLine[];
  /** The main checks that passed. */
  green: SummaryLine[];
  /** No tanker added and "none came" not answered yet (asked once, in red). */
  askNoTanker: boolean;
  ownerMessage: string;
  canSubmit: boolean;
};

const OWNER_WILL_SEE = / The owner will see this\.$/;

/** What's missing in a section, in plain words (the Summary's red list). */
function notDoneLine(section: Section, shifts: Shift[]): SummaryLine {
  const target = section.key as ReviewTarget;
  if (section.key === "sales") {
    const open = shifts.filter((s) => !s.salesDoneAt).map((s) => s.code);
    return { text: open.length ? `Sales: tap Done on Shift ${open.join(", ")}` : "Sales: tap Done on every shift", target };
  }
  if (section.key === "expenses") return { text: "Expenses: add them, or tap No expenses today", target };
  if (section.key === "openingDip" || section.key === "closingDip") return { text: `${section.title}: type every tank's dip`, target };
  return { text: `${section.title}: ${section.subtitle}`, target };
}

/** Everything the 3 Review steps show, from the engine's result and Today's sections. */
export function reviewModel(
  setup: DaySetup,
  day: Day,
  result: DayResult,
  sections: Section[],
  receipts: Receipt[],
  shifts: Shift[] = [],
): ReviewModel {
  const flagPct = new Decimal(setup.rules.stockDifference.flagBeyondPercent);
  const moneyLimit = new Decimal(setup.rules.shiftMoney.flagBeyondRupees);
  const fuels = result.products.map((p): ReviewFuel => {
    const price = result.prices[p.product];
    const about = price && !p.difference.isZero() ? `About ${fmtRupees(p.difference.abs().times(price))} · ` : "";
    return {
      product: p.product,
      name: FUEL_WORD[p.product],
      soldAsPerTank: p.soldAsPerTank,
      soldAsPerMeters: p.soldAsPerMeters,
      difference: p.difference,
      withinLimit: p.withinLimit,
      note:
        p.soldAsPerTank.isZero() && p.soldAsPerMeters.isZero()
          ? "Nothing sold today"
          : `${about}limit is ${fmtLitres(p.soldAsPerTank.abs().times(flagPct).div(100))} (${flagPct.toString()}%)`,
    };
  });
  const inUse = [...new Set(activeTanks(setup).map((t) => t.product))];
  const fuelsWaiting = inUse.filter((f) => !result.products.some((p) => p.product === f)).map((f) => FUEL_WORD[f]);
  const dayTotal = result.shifts.length ? result.shifts.reduce((t, s) => t.plus(s.difference), new Decimal(0)) : null;

  // Red: what stops Submit (PRD F12: an empty section or a red box; plus the price and the lock).
  const red: SummaryLine[] = [];
  if (day.isLocked) red.push({ text: "This day is locked. Ask the owner to unlock it." });
  if (!day.priceConfirmed) red.push({ text: "Confirm today's price on Today", target: "today" });
  for (const s of sections) if (s.key !== "tanker" && s.status !== "done" && s.status !== "locked") red.push(notDoneLine(s, shifts));
  for (const e of result.hardErrors) if (e.code !== "H4" && e.code !== "H6") red.push({ text: e.message, target: sectionFor(e) });
  const askNoTanker = receipts.length === 0 && !day.noTanker && !day.isLocked;

  // Yellow: every flag (never blocks; the owner sees them).
  const yellow = result.flags.map((f) => ({ text: f.message.replace(OWNER_WILL_SEE, ""), target: sectionFor(f) }));

  // Green: the main checks that passed.
  const green: SummaryLine[] = [];
  if (day.priceConfirmed) green.push({ text: "Today's price confirmed" });
  if (!sections.some((s) => s.key !== "tanker" && s.status !== "done")) green.push({ text: "All 8 sections done" });
  for (const p of result.products) if (p.withinLimit) green.push({ text: `${FUEL_WORD[p.product]}: tank and meters agree (within ${flagPct.toString()}%)` });
  for (const s of result.shifts) if (s.withinLimit) green.push({ text: `Shift ${s.shift} money matched (within ${fmtRupees(moneyLimit)})` });
  if (receipts.length && !result.flags.some((f) => f.code === "S6")) green.push({ text: `Tanker${receipts.length > 1 ? "s" : ""} received as per challan` });
  if (!result.hardErrors.some((e) => e.code === "H2")) green.push({ text: "No meter change waiting" });

  // The message the owner will get (canvas F8): the fuel and money headlines, then the rest as a count.
  const parts: string[] = [];
  for (const p of result.products) {
    if (!p.withinLimit) parts.push(`${FUEL_WORD[p.product]} ${p.difference.isNegative() ? "short" : "excess"} ${fmtLitres(p.difference.abs())}`);
  }
  for (const s of result.shifts) {
    if (!s.withinLimit) parts.push(`Shift ${s.shift} ${s.difference.isNegative() ? "short" : "excess"} ${fmtRupees(s.difference.abs())}`);
  }
  const others = result.flags.filter((f) => f.code !== "S1" && f.code !== "S2").length;
  if (others) parts.push(`${others} more flag${others === 1 ? "" : "s"}`);
  const ownerMessage = `${fmtDate(day.businessDate, "short")} submitted. ${parts.length ? parts.join(", ") : "Day matched."}`;

  const canSubmit = red.length === 0 && !askNoTanker;
  return { fuels, fuelsWaiting, shifts: result.shifts, dayTotal, red, yellow, green, askNoTanker, ownerMessage, canSubmit };
}

/** The last card on Today (owner, 29 Sep: Review is its own task, not a bar). */
export function reviewCard(day: Day, sectionsDoneCount: number): { subtitle: string; status: SectionStatus } {
  if (day.status !== "DRAFT") return { subtitle: `Submitted · ${day.isMatched ? "Matched" : "Not matched"}. Open to check or submit again`, status: day.isLocked ? "locked" : "done" };
  if (!day.priceConfirmed) return { subtitle: "Confirm the price first", status: "todo" };
  if (sectionsDoneCount < 8) return { subtitle: `Finish ${8 - sectionsDoneCount} more section${8 - sectionsDoneCount === 1 ? "" : "s"} first`, status: "todo" };
  return { subtitle: "Ready: check the summary and submit", status: "inProgress" };
}
