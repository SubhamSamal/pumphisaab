/**
 * Credit slips. A slip is typed either in rupees (a round fill like ₹14,000) or in litres.
 *
 *   Rupee fill:  litres = rupees ÷ today's rate, rounded (up, by default) to 2 decimals
 *   Litre fill:  rupees = litres × today's rate, rounded to the paisa
 *
 * Example from 15 Sep 2026: ₹15,000 at ₹101.74 → 147.4346… → 147.44 L (rounded up, as on the slip).
 */

import { Decimal } from "@/lib/decimal";
import { num, ZERO } from "./numbers";
import type { Rules } from "./rules";
import type { CreditSlip } from "./types";

export function slipAmounts(slip: CreditSlip, rate: Decimal, rules: Rules): { litres: Decimal; rupees: Decimal } {
  if (slip.entry.by === "rupees") {
    const rupees = num(slip.entry.rupees);
    const rounding = rules.creditSlip.litreRounding === "up" ? Decimal.ROUND_UP : Decimal.ROUND_HALF_UP;
    const litres = rate.isZero() ? ZERO : rupees.div(rate).toDecimalPlaces(rules.creditSlip.litreDecimals, rounding);
    return { litres, rupees };
  }
  const litres = num(slip.entry.litres);
  return { litres, rupees: litres.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) };
}
