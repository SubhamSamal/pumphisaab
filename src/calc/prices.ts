/**
 * Fuel price for a business day: the latest price whose start date is on or before that day.
 * Example: a new price starting 01 Oct applies to 01 Oct and later, never to 30 Sep.
 */

import type { Decimal } from "@/lib/decimal";
import { num } from "./numbers";
import type { Price, Product } from "./types";

export function priceFor(prices: Price[], product: Product, businessDate: string): Decimal | null {
  const candidates = prices
    .filter((p) => p.product === product && p.startsOn <= businessDate) // YYYY-MM-DD strings sort as dates
    .sort((a, b) => (a.startsOn < b.startsOn ? -1 : a.startsOn > b.startsOn ? 1 : 0));
  const latest = candidates[candidates.length - 1];
  return latest ? num(latest.perLitre) : null;
}
