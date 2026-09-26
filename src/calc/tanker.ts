/**
 * Tanker receipts (the IOCL invoice / challan).
 *
 *   Received          = litres ordered − litres short
 *   Amount            = litres ordered × price per litre
 *   Short amount      = litres short × price per litre
 *   To pay            = total amount − total short amount
 *   Margin earned     = litres received × margin per litre
 *   Dip rise          = litres at the dip after unloading − litres at the dip before (optional check)
 */

import type { Decimal } from "@/lib/decimal";
import { dipToLitres, type CheckedChart } from "./dipChart";
import { num, sum } from "./numbers";
import type { TankerReceipt, TankerResult } from "./types";

export function receiptTotals(receipt: TankerReceipt, charts: Map<string, CheckedChart>): TankerResult {
  const lines = receipt.lines.map((line) => {
    const ordered = num(line.orderedLitres);
    const short = num(line.shortLitres, "0");
    const price = line.pricePerLitre ? num(line.pricePerLitre) : null;
    const margin = line.marginPerLitre ? num(line.marginPerLitre) : null;
    const receivedNetLitres = ordered.minus(short);

    let dipRiseLitres: Decimal | null = null;
    const chart = charts.get(line.tankId);
    if (chart && line.dipBeforeCm && line.dipAfterCm) {
      const before = dipToLitres(chart, line.dipBeforeCm);
      const after = dipToLitres(chart, line.dipAfterCm);
      if (before && after) dipRiseLitres = after.minus(before);
    }

    return {
      product: line.product,
      tankId: line.tankId,
      receivedNetLitres,
      amount: price ? ordered.times(price) : null,
      shortAmount: price ? short.times(price) : null,
      margin: margin ? receivedNetLitres.times(margin) : null,
      dipRiseLitres,
    };
  });

  const allPriced = lines.every((l) => l.amount !== null);
  const allMargins = lines.every((l) => l.margin !== null);
  const totalAmount = allPriced ? sum(lines.map((l) => l.amount as Decimal)) : null;
  const totalShortAmount = allPriced ? sum(lines.map((l) => l.shortAmount as Decimal)) : null;

  return {
    id: receipt.id,
    lines,
    totalAmount,
    totalShortAmount,
    toPay: totalAmount && totalShortAmount ? totalAmount.minus(totalShortAmount) : null,
    totalMargin: allMargins ? sum(lines.map((l) => l.margin as Decimal)) : null,
  };
}
