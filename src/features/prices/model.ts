/**
 * Fuel prices and "Price is different" requests (D119, D120). Pure: no React, no database.
 * The database decides who may do what; these only shape what the screens show.
 */

import type { Product } from "@/calc";
import { readTypedNumber } from "@/lib/numberInput";

export type PriceRequestStatus = "WAITING" | "APPROVED" | "KEPT";
export type PriceRequest = {
  id: string;
  dayId: string;
  product: Product;
  perLitre: string;
  startsOn: string;
  status: PriceRequestStatus;
  /** Who typed it (name), when known. */
  askedBy: string | null;
  createdAt: string;
};

export type PriceListRow = { id: string; product: Product; perLitre: string; startsOn: string; margin: string | null };

/** Diesel first, like everywhere else in the app. */
export const FUEL_ORDER: Product[] = ["HSD", "MS"];

/** The waiting request per fuel for one day (at most one each; the database keeps it so). */
export function waitingForDay(requests: PriceRequest[], dayId: string): Partial<Record<Product, PriceRequest>> {
  const out: Partial<Record<Product, PriceRequest>> = {};
  for (const r of requests) if (r.dayId === dayId && r.status === "WAITING") out[r.product] = r;
  return out;
}

/** Every waiting request, oldest first (the owner answers them in order). */
export function waitingRequests(requests: PriceRequest[]): PriceRequest[] {
  return requests.filter((r) => r.status === "WAITING").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export type PriceListEntry = PriceListRow & { when: "now" | "next" | "before" };

/**
 * Each fuel's prices, newest start date first, marked: the one in force today ("now"), ones that
 * start later ("next"), and older ones ("before"). Same rule as price_for(): latest start ≤ date.
 */
export function priceList(rows: PriceListRow[], today: string): { product: Product; entries: PriceListEntry[] }[] {
  return FUEL_ORDER.map((product) => {
    const own = rows.filter((r) => r.product === product).sort((a, b) => b.startsOn.localeCompare(a.startsOn));
    const nowId = own.find((r) => r.startsOn <= today)?.id;
    return {
      product,
      entries: own.map((r) => ({ ...r, when: r.id === nowId ? ("now" as const) : r.startsOn > today ? ("next" as const) : ("before" as const) })),
    };
  }).filter((g) => g.entries.length > 0);
}

export type CheckedPrice = { kind: "ok"; value: string } | { kind: "bad"; message: string } | { kind: "empty" };

/** A price per litre as typed: 2 decimals at most, more than ₹0 and under ₹1,000 (the database refuses otherwise). */
export function checkPrice(raw: string): CheckedPrice {
  const t = readTypedNumber(raw, 2);
  if (t.kind !== "ok") return t;
  const [whole] = t.value.split(".");
  if (/^0*$/.test(t.value.replace(".", ""))) return { kind: "bad", message: "Type the price per litre, like 110.07." };
  if (whole.length > 3) return { kind: "bad", message: "That's too much for one litre. Check it." };
  return t;
}

/** A margin per litre as typed (owner): 2 decimals at most; empty is allowed (no margin yet). */
export function checkMargin(raw: string): CheckedPrice {
  const t = readTypedNumber(raw, 2);
  if (t.kind !== "ok") return t;
  if (t.value.split(".")[0].length > 2) return { kind: "bad", message: "That's too much margin for one litre. Check it." };
  return t;
}
