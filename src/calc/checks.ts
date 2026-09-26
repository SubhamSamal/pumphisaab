/**
 * Every check the app runs, one small function each.
 *
 *   Hard checks (H…)  — the number can't be right. Shown in red; the day can't be submitted until fixed.
 *   Soft checks (S…)  — the number is allowed but unusual. Saved normally and sent to the owner as a Flag.
 *                       The manager is never asked for a reason (CLAUDE.md hard rule 7).
 *   Compliance (R1)   — beyond IOCL's allowed variation. A red flag for the owner; never blocks.
 *
 * All limits come from rules.ts.
 */

import type { Decimal } from "@/lib/decimal";
import { fmtDip, fmtLitres, fmtMeter, fmtRupees } from "@/lib/format";
import { slipAmounts } from "./credit";
import { dipToLitres, type CheckedChart } from "./dipChart";
import type { ShiftLitres } from "./meters";
import { nozzleSale } from "./meters";
import { isBeyond, num, percent, percentOf, sum } from "./numbers";
import type { Rules } from "./rules";
import { beyondComplianceLimit } from "./tank";
import type {
  CustomerPayment,
  Expense,
  Issue,
  Product,
  ProductResult,
  ShiftInput,
  ShiftMoneyResult,
  TankDay,
  TankerReceipt,
  TankerResult,
} from "./types";

const FUEL_NAME: Record<Product, string> = { HSD: "Diesel", MS: "Petrol" };

/** Human-friendly percentage with 2 decimals, e.g. "0.53%". */
function pct(value: Decimal): string {
  return `${value.abs().toFixed(2)}%`;
}

// ─── Hard checks ──────────────────────────────────────────────────────────

/** H1: closing reading below opening. H2: opening doesn't match the last closing without an approved meter change. */
export function checkMeterReadings(shift: ShiftInput): Issue[] {
  const issues: Issue[] = [];
  for (const n of shift.nozzles) {
    if (!n.inUse || n.opening === undefined) continue;
    const opening = num(n.opening);

    if (n.closing !== undefined && num(n.closing).lessThan(opening)) {
      issues.push({
        code: "H1",
        severity: "hard",
        message: `${n.label}: closing can't be less than opening (${fmtMeter(opening)}). Check the meter again.`,
        where: { shift: shift.code, nozzleId: n.nozzleId },
        numbers: { opening, closing: num(n.closing) },
      });
    }

    if (n.previousClosing !== undefined && !opening.equals(num(n.previousClosing)) && !n.meterChangeApproved) {
      issues.push({
        code: "H2",
        severity: "hard",
        message: `${n.label}: opening ${fmtMeter(opening)} isn't the last closing ${fmtMeter(num(n.previousClosing))}. Waiting for the owner to approve the meter change.`,
        where: { shift: shift.code, nozzleId: n.nozzleId },
        numbers: { opening, previousClosing: num(n.previousClosing) },
      });
    }
  }
  return issues;
}

/** H3: dip outside the tank chart. */
export function checkDipsInChart(tankDays: TankDay[], charts: Map<string, CheckedChart>, labels: Map<string, string>): Issue[] {
  const issues: Issue[] = [];
  for (const day of tankDays) {
    const chart = charts.get(day.tankId);
    if (!chart) continue;
    const readings: [string, string | undefined][] = [
      ["Opening dip", day.openingDipCm],
      ["Closing dip", day.closingDipCm],
    ];
    for (const [name, cm] of readings) {
      if (cm === undefined) continue;
      if (dipToLitres(chart, cm) === null) {
        issues.push({
          code: "H3",
          severity: "hard",
          message: `${labels.get(day.tankId) ?? "Tank"} ${name.toLowerCase()} ${fmtDip(num(cm))} is outside the tank chart (0 to ${fmtDip(chart.maxDipCm)}). Check the reading.`,
          where: { tankId: day.tankId },
          numbers: { dipCm: num(cm), maxDipCm: chart.maxDipCm },
        });
      }
    }
  }
  return issues;
}

/** H4: every Today section must be done before submitting. */
export function checkSectionsDone(sectionsDone: Record<string, boolean> | undefined): Issue[] {
  if (!sectionsDone) return [];
  const notDone = Object.entries(sectionsDone).filter(([, done]) => !done).map(([name]) => name);
  if (notDone.length === 0) return [];
  return [
    {
      code: "H4",
      severity: "hard",
      message: `Finish ${notDone.length} more section${notDone.length === 1 ? "" : "s"} to submit: ${notDone.join(", ")}.`,
    },
  ];
}

/** H5: no negative amounts, counts, litres or readings anywhere. */
export function checkNoNegatives(
  values: { what: string; value: string | undefined; where?: Issue["where"] }[],
): Issue[] {
  return values
    .filter((v) => v.value !== undefined && v.value.trim() !== "" && num(v.value).isNegative())
    .map((v) => ({
      code: "H5",
      severity: "hard" as const,
      message: `${v.what} can't be negative.`,
      where: v.where,
      numbers: { value: num(v.value) },
    }));
}

/** H6: nothing money-related is worked out until today's prices are confirmed. */
export function checkPrices(confirmed: boolean, prices: Partial<Record<Product, Decimal>>, fuelsInUse: Product[]): Issue[] {
  const issues: Issue[] = [];
  if (!confirmed) {
    issues.push({ code: "H6", severity: "hard", message: "Confirm today's price first." });
  }
  for (const p of fuelsInUse) {
    if (!prices[p]) {
      issues.push({
        code: "H6",
        severity: "hard",
        message: `No ${FUEL_NAME[p]} price for today. Ask the owner to add it in Profile › Fuel prices.`,
        where: { product: p },
      });
    }
  }
  return issues;
}

/** H7: a slip number can be used only once (the pump's own slip books). */
export function checkSlipNumbers(shifts: ShiftInput[], earlierSlipNumbers: string[] = []): Issue[] {
  const issues: Issue[] = [];
  const seen = new Map<string, string>(); // slip number → customer
  const earlier = new Set(earlierSlipNumbers.map((s) => s.trim()));
  for (const shift of shifts) {
    for (const slip of shift.creditSlips) {
      const no = slip.slipNo.trim();
      if (earlier.has(no)) {
        issues.push({
          code: "H7",
          severity: "hard",
          message: `Slip ${no} was already used on an earlier day. Check the slip number.`,
          where: { shift: shift.code, slipNo: no },
        });
      } else if (seen.has(no)) {
        issues.push({
          code: "H7",
          severity: "hard",
          message: `Slip ${no} is already saved for ${seen.get(no)}. Check the slip number.`,
          where: { shift: shift.code, slipNo: no },
        });
      } else {
        seen.set(no, slip.customer);
      }
    }
  }
  return issues;
}

/** H8: a nozzle can't be tested with more litres than it sold in that shift. */
export function checkTests(shift: ShiftInput): Issue[] {
  const issues: Issue[] = [];
  for (const nozzle of shift.nozzles) {
    const tested = sum(shift.tests.filter((t) => t.nozzleId === nozzle.nozzleId).map((t) => num(t.litres, "0")));
    if (tested.isZero()) continue;
    const sold = nozzleSale(nozzle);
    if (sold !== null && tested.greaterThan(sold)) {
      issues.push({
        code: "H8",
        severity: "hard",
        message: `${nozzle.label}: ${fmtLitres(tested)} tested but the meter shows only ${fmtLitres(sold)} sold this shift.`,
        where: { shift: shift.code, nozzleId: nozzle.nozzleId },
        numbers: { tested, sold },
      });
    }
  }
  return issues;
}

/** H9: credit litres of a fuel can't be more than the litres the meters sold in that shift. */
export function checkCreditLitres(
  shift: ShiftInput,
  litres: ShiftLitres,
  prices: Partial<Record<Product, Decimal>>,
  rules: Rules,
): Issue[] {
  const issues: Issue[] = [];
  for (const product of ["MS", "HSD"] as Product[]) {
    const rate = prices[product];
    if (!rate) continue;
    const creditLitres = sum(
      shift.creditSlips.filter((s) => s.product === product).map((s) => slipAmounts(s, rate, rules).litres),
    );
    const sold = litres.soldAsPerMeters[product];
    if (!creditLitres.isZero() && creditLitres.greaterThan(sold)) {
      issues.push({
        code: "H9",
        severity: "hard",
        message: `Shift ${shift.code}: ${FUEL_NAME[product]} credit slips add up to ${fmtLitres(creditLitres)}, more than the ${fmtLitres(sold)} the meters sold.`,
        where: { shift: shift.code, product },
        numbers: { creditLitres, sold },
      });
    }
  }
  return issues;
}

// ─── Soft checks (flags for the owner) ────────────────────────────────────

/** S1 and R1: the fuel check for the day. */
export function checkStock(result: ProductResult, rules: Rules): Issue[] {
  const issues: Issue[] = [];
  const name = FUEL_NAME[result.product];
  const numbers = {
    soldAsPerTank: result.soldAsPerTank,
    soldAsPerMeters: result.soldAsPerMeters,
    difference: result.difference,
  };

  if (!result.withinLimit) {
    const word = result.difference.isNegative() ? "short" : "excess";
    const share = result.differencePercent ? ` (${pct(result.differencePercent)})` : "";
    issues.push({
      code: "S1",
      severity: "soft",
      message: `${name} ${word} ${fmtLitres(result.difference.abs())}${share}: tank vs meters. The owner will see this.`,
      where: { product: result.product },
      numbers,
    });
  }

  if (beyondComplianceLimit(result, rules)) {
    issues.push({
      code: "R1",
      severity: "compliance",
      message: `${name} difference ${pct(result.differencePercent as Decimal)} is beyond IOCL's allowed variation.`,
      where: { product: result.product },
      numbers,
    });
  }
  return issues;
}

/** S2: a shift's money is short or excess beyond the limit. */
export function checkShiftMoney(result: ShiftMoneyResult): Issue[] {
  if (result.withinLimit) return [];
  const word = result.difference.isNegative() ? "short" : "excess";
  return [
    {
      code: "S2",
      severity: "soft",
      message: `Shift ${result.shift} ${word} ${fmtRupees(result.difference.abs())}. The owner will see this.`,
      where: { shift: result.shift },
      numbers: { shouldHave: result.shouldHave, received: result.received, difference: result.difference },
    },
  ];
}

/** S3: IOCL book stock vs opening dip — flag if the gap moved since yesterday. S7: opening dip vs last night's closing dip. */
export function checkOpeningStock(
  tankDays: TankDay[],
  charts: Map<string, CheckedChart>,
  labels: Map<string, string>,
  rules: Rules,
): Issue[] {
  const issues: Issue[] = [];
  for (const day of tankDays) {
    const chart = charts.get(day.tankId);
    const label = labels.get(day.tankId) ?? "Tank";
    const openingLitres = chart ? dipToLitres(chart, day.openingDipCm) : null;

    if (openingLitres && day.bookStockLitres !== undefined && day.yesterdayBookGapLitres !== undefined) {
      const gapToday = num(day.bookStockLitres).minus(openingLitres);
      const moved = gapToday.minus(num(day.yesterdayBookGapLitres));
      const limit = percent(openingLitres, num(rules.bookStockGap.flagBeyondPercentOfDip));
      if (isBeyond(moved, limit)) {
        issues.push({
          code: "S3",
          severity: "soft",
          message: `${label}: the gap between the IOCL book stock and the dip moved by ${fmtLitres(moved.abs())} since yesterday. Check the dip once more. The owner will see this.`,
          where: { tankId: day.tankId },
          numbers: { gapToday, gapYesterday: num(day.yesterdayBookGapLitres), moved },
        });
      }
    }

    if (day.yesterdayClosingDipCm !== undefined) {
      const change = num(day.openingDipCm).minus(num(day.yesterdayClosingDipCm));
      if (isBeyond(change, num(rules.openingDip.flagBeyondCm))) {
        issues.push({
          code: "S7",
          severity: "soft",
          message: `${label}: opening dip ${fmtDip(num(day.openingDipCm))} but last night's closing dip was ${fmtDip(num(day.yesterdayClosingDipCm))}. The owner will see this.`,
          where: { tankId: day.tankId },
          numbers: { change },
        });
      }
    }
  }
  return issues;
}

/** S4: an in-use nozzle sold nothing all day, or much more than its recent average. */
export function checkNozzleDaySales(
  shifts: ShiftInput[],
  history: Record<string, string[]> | undefined,
  rules: Rules,
): Issue[] {
  const issues: Issue[] = [];
  const nozzles = new Map<string, { label: string; sold: Decimal; complete: boolean }>();
  for (const shift of shifts) {
    for (const n of shift.nozzles) {
      if (!n.inUse) continue;
      const entry = nozzles.get(n.nozzleId) ?? { label: n.label, sold: num("0"), complete: true };
      const sale = nozzleSale(n);
      if (sale === null) entry.complete = false;
      else entry.sold = entry.sold.plus(sale);
      nozzles.set(n.nozzleId, entry);
    }
  }

  for (const [nozzleId, { label, sold, complete }] of nozzles) {
    if (!complete) continue;
    if (rules.nozzleSales.flagZeroSale && sold.isZero()) {
      issues.push({ code: "S4", severity: "soft", message: `${label} sold nothing today. The owner will see this.`, where: { nozzleId } });
      continue;
    }
    const past = (history?.[nozzleId] ?? []).slice(-rules.nozzleSales.historyDays).map((v) => num(v));
    if (past.length < rules.nozzleSales.minHistoryDays) continue;
    const average = sum(past).div(past.length);
    if (!average.isZero() && sold.greaterThan(average.times(num(rules.nozzleSales.spikeMultiple)))) {
      issues.push({
        code: "S4",
        severity: "soft",
        message: `${label} sold ${fmtLitres(sold)} today, more than ${rules.nozzleSales.spikeMultiple} times its usual ${fmtLitres(average)}. The owner will see this.`,
        where: { nozzleId },
        numbers: { sold, average },
      });
    }
  }
  return issues;
}

/** S6: tanker short beyond the limit, or the dip rise doesn't agree with litres received. */
export function checkTanker(receipt: TankerReceipt, result: TankerResult, rules: Rules): Issue[] {
  const issues: Issue[] = [];
  receipt.lines.forEach((line, i) => {
    const ordered = num(line.orderedLitres);
    const short = num(line.shortLitres, "0");
    const shortPct = percentOf(short, ordered);
    if (shortPct && isBeyond(shortPct, num(rules.tanker.shortFlagBeyondPercent))) {
      issues.push({
        code: "S6",
        severity: "soft",
        message: `${FUEL_NAME[line.product]} tanker short ${fmtLitres(short)} out of ${fmtLitres(ordered)}. More than usual. The owner will see this.`,
        where: { product: line.product, tankId: line.tankId },
        numbers: { ordered, short },
      });
    }
    const rise = result.lines[i].dipRiseLitres;
    const received = result.lines[i].receivedNetLitres;
    const gapPct = rise ? percentOf(rise.minus(received), received) : null;
    if (rise && gapPct && isBeyond(gapPct, num(rules.tanker.dipCheckFlagBeyondPercent))) {
      issues.push({
        code: "S6",
        severity: "soft",
        message: `${FUEL_NAME[line.product]}: the tank went up ${fmtLitres(rise)} but the challan says ${fmtLitres(received)}. The owner will see this.`,
        where: { product: line.product, tankId: line.tankId },
        numbers: { rise, received },
      });
    }
  });
  return issues;
}

/** S9: an expense type went over its daily cap (only types the owner has capped). */
export function checkExpenseCaps(expenses: Expense[], rules: Rules): Issue[] {
  const issues: Issue[] = [];
  for (const [type, cap] of Object.entries(rules.expenseDailyCaps)) {
    const spent = sum(expenses.filter((e) => e.type === type).map((e) => num(e.rupees)));
    if (spent.greaterThan(num(cap))) {
      issues.push({
        code: "S9",
        severity: "soft",
        message: `${type} ${fmtRupees(spent)} is more than the ${fmtRupees(num(cap))} daily limit. The owner will see this.`,
        numbers: { spent, cap: num(cap) },
      });
    }
  }
  return issues;
}

/** The list of typed values H5 looks at. */
export function typedValues(shifts: ShiftInput[], expenses: Expense[], payments: CustomerPayment[], tankDays: TankDay[], tankers: TankerReceipt[]) {
  const values: { what: string; value: string | undefined; where?: Issue["where"] }[] = [];
  for (const d of tankDays) {
    values.push({ what: "Opening dip", value: d.openingDipCm, where: { tankId: d.tankId } });
    values.push({ what: "Closing dip", value: d.closingDipCm, where: { tankId: d.tankId } });
    values.push({ what: "IOCL book stock", value: d.bookStockLitres, where: { tankId: d.tankId } });
  }
  for (const s of shifts) {
    for (const n of s.nozzles) {
      values.push({ what: `${n.label} opening`, value: n.opening, where: { shift: s.code, nozzleId: n.nozzleId } });
      values.push({ what: `${n.label} closing`, value: n.closing, where: { shift: s.code, nozzleId: n.nozzleId } });
    }
    for (const t of s.tests) values.push({ what: "Test litres", value: t.litres, where: { shift: s.code, nozzleId: t.nozzleId } });
    values.push({ what: "Opening cash", value: s.openingCash, where: { shift: s.code } });
    if (s.cash && "byNotes" in s.cash) {
      for (const n of s.cash.byNotes) values.push({ what: `₹${n.noteValue} note count`, value: n.count, where: { shift: s.code } });
      values.push({ what: "Coins", value: s.cash.coins, where: { shift: s.code } });
    }
    if (s.cash && "total" in s.cash) values.push({ what: "Cash", value: s.cash.total, where: { shift: s.code } });
    for (const p of s.otherPayments) values.push({ what: p.type, value: p.amount, where: { shift: s.code } });
    for (const slip of s.creditSlips) {
      const v = slip.entry.by === "rupees" ? slip.entry.rupees : slip.entry.litres;
      values.push({ what: `Slip ${slip.slipNo}`, value: v, where: { shift: s.code, slipNo: slip.slipNo } });
    }
  }
  for (const e of expenses) values.push({ what: `${e.type} expense`, value: e.rupees });
  for (const p of payments) values.push({ what: `Payment from ${p.customer}`, value: p.rupees, where: { shift: p.shift } });
  for (const t of tankers) {
    for (const l of t.lines) {
      values.push({ what: "Tanker litres ordered", value: l.orderedLitres, where: { tankId: l.tankId } });
      values.push({ what: "Tanker litres short", value: l.shortLitres, where: { tankId: l.tankId } });
    }
  }
  return values;
}
