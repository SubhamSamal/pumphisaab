/**
 * The money check, per shift:
 *
 *   Should have  = litres sold as per meters × today's price   (for each fuel, added up)
 *
 *   Received     = cash counted in the drawer − cash that was already there at the start
 *                + Paytm + Card + XtraPower + Bank transfer    (totals typed from each machine/app)
 *                + credit slips
 *                + expenses paid out of this shift's drawer    (that cash was received, then spent)
 *                − customer payments of old dues / advances    (money in, but not for today's fuel)
 *
 *   Difference   = Received − Should have      (negative = short, positive = excess)
 */

import type { Decimal } from "@/lib/decimal";
import { slipAmounts } from "./credit";
import type { ShiftLitres } from "./meters";
import { isBeyond, num, sum } from "./numbers";
import type { Rules } from "./rules";
import type { CashCount, CustomerPayment, Expense, Product, ShiftInput, ShiftMoneyResult } from "./types";

/** Notes × value + coins, or the total when importing an old notebook day. */
export function cashTotal(cash: CashCount): Decimal {
  if ("total" in cash) return num(cash.total);
  return sum(cash.byNotes.map((n) => num(n.noteValue).times(num(n.count, "0")))).plus(num(cash.coins, "0"));
}

/** Null until the shift's cash has been counted or a price is missing. */
export function shiftMoney(
  shift: ShiftInput,
  litres: ShiftLitres,
  prices: Partial<Record<Product, Decimal>>,
  expenses: Expense[],
  customerPayments: CustomerPayment[],
  rules: Rules,
): ShiftMoneyResult | null {
  if (!shift.cash) return null;
  const products: Product[] = ["MS", "HSD"];
  if (products.some((p) => !litres.soldAsPerMeters[p].isZero() && !prices[p])) return null;

  const shouldHave = sum(products.map((p) => (prices[p] ? litres.soldAsPerMeters[p].times(prices[p]) : num("0"))));

  const cashCounted = cashTotal(shift.cash);
  const openingCash = num(shift.openingCash, "0");
  const otherPayments = shift.otherPayments.map((p) => ({ type: p.type, amount: num(p.amount, "0") }));
  const creditSlips = sum(
    shift.creditSlips.map((slip) => {
      const rate = prices[slip.product];
      return rate ? slipAmounts(slip, rate, rules).rupees : num("0");
    }),
  );
  const drawerExpenses = sum(
    expenses.filter((e) => e.paidFrom === `SHIFT_${shift.code}`).map((e) => num(e.rupees)),
  );
  const customerPaymentsTakenOff = sum(
    customerPayments.filter((p) => p.shift === shift.code).map((p) => num(p.rupees)),
  );

  const received = cashCounted
    .minus(openingCash)
    .plus(sum(otherPayments.map((p) => p.amount)))
    .plus(creditSlips)
    .plus(drawerExpenses)
    .minus(customerPaymentsTakenOff);

  const difference = received.minus(shouldHave);

  return {
    shift: shift.code,
    litres: litres.soldAsPerMeters,
    shouldHave,
    received,
    receivedParts: { cashCounted, openingCash, otherPayments, creditSlips, drawerExpenses, customerPaymentsTakenOff },
    difference,
    withinLimit: !isBeyond(difference, num(rules.shiftMoney.flagBeyondRupees)),
  };
}
