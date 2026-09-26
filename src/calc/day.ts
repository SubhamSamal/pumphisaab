/**
 * One whole business day, start to finish.
 *
 * evaluateDay() takes everything the manager typed for the day and returns:
 *   • per fuel:  sold as per tank, sold as per meters, Difference
 *   • per shift: Should have, Received, Difference
 *   • tanker totals
 *   • hard errors (block submit) and flags (go to the owner)
 *   • whether the day is Matched
 *
 * It never changes the input and never rounds: rounding happens only on screen.
 */

import type { Decimal } from "@/lib/decimal";
import {
  checkCreditLitres,
  checkDipsInChart,
  checkExpenseCaps,
  checkMeterReadings,
  checkNoNegatives,
  checkNozzleDaySales,
  checkOpeningStock,
  checkPrices,
  checkSectionsDone,
  checkShiftMoney,
  checkSlipNumbers,
  checkStock,
  checkTanker,
  checkTests,
  typedValues,
} from "./checks";
import { checkChart, type CheckedChart } from "./dipChart";
import { shiftLitres } from "./meters";
import { shiftMoney } from "./money";
import { priceFor } from "./prices";
import { DEFAULT_RULES, type Rules } from "./rules";
import { productStock } from "./tank";
import { receiptTotals } from "./tanker";
import type { DayInput, DayResult, Issue, Product, ProductResult, ShiftMoneyResult } from "./types";

const FUELS: Product[] = ["MS", "HSD"];

export function evaluateDay(day: DayInput, rules: Rules = DEFAULT_RULES): DayResult {
  // 1. Tank charts (already checked when uploaded; checked again here so a bad chart can't slip through).
  const charts = new Map<string, CheckedChart>();
  const labels = new Map(day.tanks.map((t) => [t.id, t.label]));
  for (const tank of day.tanks) {
    const { chart } = checkChart(tank.chart);
    if (chart) charts.set(tank.id, chart);
  }

  // 2. Today's price per fuel. Money is worked out only once the manager has confirmed it.
  const pricesFound: Partial<Record<Product, Decimal>> = {};
  for (const fuel of FUELS) {
    const price = priceFor(day.prices, fuel, day.businessDate);
    if (price) pricesFound[fuel] = price;
  }
  const prices = day.priceConfirmed ? pricesFound : {};

  // 3. Litres per shift, tanker totals, then the two matches.
  const litresPerShift = day.shifts.map(shiftLitres);
  const tankers = day.tankers.map((t) => receiptTotals(t, charts));

  const tankInfo = day.tanks.flatMap((t) => (charts.has(t.id) ? [{ id: t.id, product: t.product, chart: charts.get(t.id) as CheckedChart }] : []));
  const products = FUELS.map((fuel) => productStock(fuel, tankInfo, day.tankDays, tankers, litresPerShift, rules)).filter(
    (p): p is ProductResult => p !== null,
  );

  const shifts = day.shifts
    .map((shift, i) => shiftMoney(shift, litresPerShift[i], prices, day.expenses, day.customerPayments, rules))
    .filter((s): s is ShiftMoneyResult => s !== null);

  // 4. Checks.
  const fuelsInUse = FUELS.filter((f) => day.tanks.some((t) => t.product === f));
  const hardErrors: Issue[] = [
    ...day.shifts.flatMap(checkMeterReadings), // H1, H2
    ...checkDipsInChart(day.tankDays, charts, labels), // H3
    ...checkSectionsDone(day.sectionsDone), // H4
    ...checkNoNegatives(typedValues(day.shifts, day.expenses, day.customerPayments, day.tankDays, day.tankers)), // H5
    ...checkPrices(day.priceConfirmed, pricesFound, fuelsInUse), // H6
    ...checkSlipNumbers(day.shifts, day.earlierSlipNumbers), // H7
    ...day.shifts.flatMap(checkTests), // H8
    ...day.shifts.flatMap((s, i) => checkCreditLitres(s, litresPerShift[i], prices, rules)), // H9
  ];

  const flags: Issue[] = [
    ...products.flatMap((p) => checkStock(p, rules)), // S1, R1
    ...shifts.flatMap(checkShiftMoney), // S2
    ...checkOpeningStock(day.tankDays, charts, labels, rules), // S3, S7
    ...checkNozzleDaySales(day.shifts, day.nozzleHistory, rules), // S4
    ...day.tankers.flatMap((t, i) => checkTanker(t, tankers[i], rules)), // S6
    ...checkExpenseCaps(day.expenses, rules), // S9
  ];

  // 5. Matched: every fuel and every shift worked out and within limits, and no hard errors.
  const everyFuelDone = products.length === fuelsInUse.length;
  const everyShiftDone = shifts.length === day.shifts.length && day.shifts.length > 0;
  const isMatched =
    hardErrors.length === 0 &&
    everyFuelDone &&
    everyShiftDone &&
    products.every((p) => p.withinLimit) &&
    shifts.every((s) => s.withinLimit);

  return { prices, products, shifts, tankers, hardErrors, flags, isMatched };
}
