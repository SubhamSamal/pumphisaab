import { Decimal, toDecimal, type DecimalInput } from "./decimal";

/** True minus sign (U+2212). A hyphen-minus is never used for a negative number. */
export const MINUS = "−";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Indian digit grouping for a non-negative integer string: 150490 -> 1,50,490. */
function groupIndian(intDigits: string): string {
  if (intDigits.length <= 3) return intDigits;
  const last3 = intDigits.slice(-3);
  const rest = intDigits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

/** Absolute value rounded half-up to `decimals`, grouped the Indian way. */
function groupedAbs(d: Decimal, decimals: number): string {
  const fixed = d.abs().toFixed(decimals, Decimal.ROUND_HALF_UP);
  const [intPart, frac] = fixed.split(".");
  return frac ? `${groupIndian(intPart)}.${frac}` : groupIndian(intPart);
}

/** Litres: whole numbers without decimals, anything else with exactly 2. */
function litreDigits(d: Decimal): string {
  const rounded = d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return groupedAbs(rounded, rounded.isInteger() ? 0 : 2);
}

function sign(d: Decimal): string {
  return d.isNegative() && !d.isZero() ? MINUS : "";
}

/**
 * ₹ with Indian grouping. `input` style keeps 2 decimals (₹1,50,490.00); `summary` has none (₹1,50,490).
 */
export function fmtRupees(value: DecimalInput, style: "input" | "summary" = "summary"): string {
  const decimals = style === "input" ? 2 : 0;
  const d = toDecimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
  return `${sign(d)}₹${groupedAbs(d, decimals)}`;
}

/** 48,210.50 L · 8,119 L */
export function fmtLitres(value: DecimalInput): string {
  const d = toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return `${sign(d)}${litreDigits(d)} L`;
}

/** Meter readings: always 2 decimals, no unit (48,210.00). */
export function fmtMeter(value: DecimalInput): string {
  const d = toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return `${sign(d)}${groupedAbs(d, 2)}`;
}

/** 123.5 cm */
export function fmtDip(value: DecimalInput): string {
  const d = toDecimal(value).toDecimalPlaces(1, Decimal.ROUND_HALF_UP);
  return `${sign(d)}${groupedAbs(d, 1)} cm`;
}

function parseIsoDate(isoDate: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error(`Expected YYYY-MM-DD, got ${isoDate}`);
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new Error(`Not a real date: ${isoDate}`);
  }
  return { y, m, d };
}

/**
 * Business dates are plain YYYY-MM-DD strings (no time, no time zone), so no clock can shift them.
 * "01 Oct 2026"; with weekday: "Thu, 01 Oct 2026"; short: "01 Oct".
 */
export function fmtDate(isoDate: string, style: "default" | "weekday" | "short" = "default"): string {
  const { y, m, d } = parseIsoDate(isoDate);
  const dd = String(d).padStart(2, "0");
  const base = `${dd} ${MONTHS[m - 1]}`;
  if (style === "short") return base;
  if (style === "weekday") return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${base} ${y}`;
  return `${base} ${y}`;
}

/** Vehicle numbers: uppercase, no spaces or dashes (OD05AB1234). */
export function fmtVehicle(value: string): string {
  return value.toUpperCase().replace(/[\s-]/g, "");
}

export type DifferenceTone = "loss" | "excess" | "matched";

export type FormattedDifference = {
  tone: DifferenceTone;
  /** Word shown next to the value so colour is never the only signal. */
  word: "Short" | "Excess" | "Matched";
  /** "−₹1,250", "+₹300", "−42 L (−0.53%)", or "Matched". */
  text: string;
};

/**
 * Sign rule (CLAUDE.md hard rule 8): negative = loss (red, true minus), positive = excess (amber),
 * zero = Matched (green). The tone follows the value as displayed, so a difference that rounds to
 * zero shows Matched rather than "−₹0".
 */
export function fmtDifference(
  value: DecimalInput,
  unit: "rupees" | "litres",
  /** For litres: the base for the percentage (Sold as per tank). Omit to show no percentage. */
  percentOf?: DecimalInput,
): FormattedDifference {
  const decimals = unit === "rupees" ? 0 : 2;
  const d = toDecimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
  if (d.isZero()) return { tone: "matched", word: "Matched", text: "Matched" };

  const s = d.isNegative() ? MINUS : "+";
  let text = unit === "rupees" ? `${s}₹${groupedAbs(d, 0)}` : `${s}${litreDigits(d)} L`;

  if (unit === "litres" && percentOf !== undefined) {
    const base = toDecimal(percentOf);
    if (!base.isZero()) {
      const pct = toDecimal(value).div(base).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const pctSign = pct.isZero() ? "" : pct.isNegative() ? MINUS : "+";
      text += ` (${pctSign}${pct.abs().toFixed(2)}%)`;
    }
  }

  return d.isNegative() ? { tone: "loss", word: "Short", text } : { tone: "excess", word: "Excess", text };
}
