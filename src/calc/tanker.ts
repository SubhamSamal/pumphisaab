/**
 * Tanker receipts (the IOCL invoice / challan).
 *
 *   Received          = litres ordered − litres short
 *   Amount            = litres ordered × price per litre      (price = today's selling price − margin)
 *   Short amount      = litres short × price per litre
 *   To pay            = invoice amount (typed from the challan, else the amount above) − short amount
 *   Margin earned     = litres received × margin per litre
 *   Dip rise          = litres at the dip after unloading − litres at the dip before
 *   Per chamber       = rise = litres at the dip after this chamber − litres before it (the previous
 *                       chamber's after, or the dip before unloading); short = chamber litres − rise
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

    let previous = chart && line.dipBeforeCm ? dipToLitres(chart, line.dipBeforeCm) : null;
    const chambers = (line.chambers ?? []).map((c) => {
      const litres = num(c.litres);
      const after = chart ? dipToLitres(chart, c.dipAfterCm) : null;
      const riseLitres = previous && after ? after.minus(previous) : null;
      previous = after;
      return { litres, riseLitres, shortLitres: riseLitres ? litres.minus(riseLitres) : null };
    });

    return {
      product: line.product,
      tankId: line.tankId,
      receivedNetLitres,
      amount: price ? ordered.times(price) : null,
      shortAmount: price ? short.times(price) : null,
      margin: margin ? receivedNetLitres.times(margin) : null,
      dipRiseLitres,
      chambers,
    };
  });

  const allPriced = lines.every((l) => l.amount !== null);
  const allMargins = lines.every((l) => l.margin !== null);
  const totalAmount = allPriced ? sum(lines.map((l) => l.amount as Decimal)) : null;
  const totalShortAmount = allPriced ? sum(lines.map((l) => l.shortAmount as Decimal)) : null;
  const invoiceAmount = receipt.invoiceAmount ? num(receipt.invoiceAmount) : null;
  const billed = invoiceAmount ?? totalAmount;

  return {
    id: receipt.id,
    lines,
    totalAmount,
    invoiceAmount,
    totalShortAmount,
    toPay: billed && totalShortAmount ? billed.minus(totalShortAmount) : null,
    totalMargin: allMargins ? sum(lines.map((l) => l.margin as Decimal)) : null,
  };
}
