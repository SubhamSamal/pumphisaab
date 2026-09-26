/**
 * Small helpers for exact decimal maths. Every litre and rupee goes through these.
 */

import { Decimal, toDecimal } from "@/lib/decimal";
import type { Num } from "./types";

export const ZERO = new Decimal(0);

/** Text number → exact decimal. An empty/missing value counts as zero only when a fallback is given. */
export function num(value: Num | undefined, fallback?: Num): Decimal {
  if (value === undefined || value.trim() === "") {
    if (fallback === undefined) throw new Error("A number is missing");
    return toDecimal(fallback);
  }
  return toDecimal(value.trim());
}

/** Add up a list of decimals. */
export function sum(values: Decimal[]): Decimal {
  return values.reduce((total, v) => total.plus(v), ZERO);
}

/** "Beyond the limit" means strictly more than it, ignoring the sign: exactly at the limit is OK. */
export function isBeyond(value: Decimal, limit: Decimal): boolean {
  return value.abs().greaterThan(limit);
}

/** part as a % of whole. Null when whole is zero (a percentage can't be worked out). */
export function percentOf(part: Decimal, whole: Decimal): Decimal | null {
  if (whole.isZero()) return null;
  return part.div(whole).times(100);
}

/** x% of an amount. */
export function percent(amount: Decimal, pct: Decimal): Decimal {
  return amount.times(pct).div(100);
}
