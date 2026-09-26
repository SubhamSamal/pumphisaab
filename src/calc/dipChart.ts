/**
 * Dip chart: turns a dip reading in cm into litres, using the tank's calibration chart.
 *
 * Between two rows of the chart we read in a straight line. Example with the pilot chart:
 *   123 cm = 13,163.73 L and 124 cm = 13,292.84 L, so 123.4 cm = 13,163.73 + 0.4 × 129.11 = 13,215.37 L.
 */

import type { Decimal } from "@/lib/decimal";
import { num } from "./numbers";
import type { DipChartRow, Num } from "./types";

export type CheckedChart = {
  rows: { dipCm: Decimal; litres: Decimal }[];
  /** Full tank: the chart's last row (e.g. 21,628.93 L), never the nominal 20 KL. */
  capacityLitres: Decimal;
  maxDipCm: Decimal;
};

export type ChartProblem = { row: number; message: string };

/**
 * Checks an uploaded chart before it is saved.
 * Rules: numbers only; dip and litres both go up row by row; exact duplicate rows are dropped;
 * a 0 cm = 0 L row is added if missing.
 */
export function checkChart(rows: DipChartRow[]): { chart: CheckedChart | null; problems: ChartProblem[] } {
  const problems: ChartProblem[] = [];
  const clean: { dipCm: Decimal; litres: Decimal }[] = [];

  rows.forEach((row, index) => {
    const rowNo = index + 1;
    let dipCm: Decimal;
    let litres: Decimal;
    try {
      dipCm = num(row.dipCm);
      litres = num(row.litres);
    } catch {
      problems.push({ row: rowNo, message: `Row ${rowNo} has something that isn't a number.` });
      return;
    }
    if (dipCm.isNegative() || litres.isNegative()) {
      problems.push({ row: rowNo, message: `Row ${rowNo} has a negative number.` });
      return;
    }
    const previous = clean[clean.length - 1];
    if (previous && previous.dipCm.equals(dipCm) && previous.litres.equals(litres)) return; // exact duplicate: drop it
    if (previous && !dipCm.greaterThan(previous.dipCm)) {
      problems.push({ row: rowNo, message: `${dipCm.toString()} cm appears twice or goes down (row ${rowNo}).` });
      return;
    }
    if (previous && !litres.greaterThan(previous.litres)) {
      problems.push({ row: rowNo, message: `Litres don't go up at row ${rowNo}.` });
      return;
    }
    clean.push({ dipCm, litres });
  });

  if (problems.length > 0 || clean.length === 0) {
    if (clean.length === 0 && problems.length === 0) problems.push({ row: 0, message: "The chart is empty." });
    return { chart: null, problems };
  }

  if (!clean[0].dipCm.isZero()) clean.unshift({ dipCm: num("0"), litres: num("0") });

  const last = clean[clean.length - 1];
  return { chart: { rows: clean, capacityLitres: last.litres, maxDipCm: last.dipCm }, problems: [] };
}

/** Dip cm → litres. Returns null when the dip is outside the chart (hard check H3). */
export function dipToLitres(chart: CheckedChart, dipCm: Num | Decimal): Decimal | null {
  const cm = typeof dipCm === "string" ? num(dipCm) : dipCm;
  if (cm.isNegative() || cm.greaterThan(chart.maxDipCm)) return null;

  // Find the chart rows just below and just above the reading.
  for (let i = 0; i < chart.rows.length; i++) {
    const row = chart.rows[i];
    if (row.dipCm.equals(cm)) return row.litres;
    if (row.dipCm.greaterThan(cm)) {
      const below = chart.rows[i - 1];
      const share = cm.minus(below.dipCm).div(row.dipCm.minus(below.dipCm));
      return below.litres.plus(row.litres.minus(below.litres).times(share));
    }
  }
  return null;
}
