/**
 * Tanker receipts (the IOCL invoice / challan).
 *
 *   Received          = litres ordered − litres short
 *   Amount            = litres ordered × price per litre      (price = today's selling price − margin)
 *   Short amount      = litres short × price per litre
 *   To pay            = invoice amount (typed from the challan, else the amount above) − short amount
 *   Margin earned     = litres received × margin per litre
 *   Per chamber       = rise = litres at the dip after this chamber − litres at the dip before it;
 *                       short = chamber litres − rise
 *   Dip rise          = with chambers: the chambers' rises added up (fuel may be sold between
 *                       chambers, so after-last − before-first would be wrong); without: after − before
 *   Next day (D97)    = chambers unloaded after 6 AM the next day count as received that day;
 *                       the tanker's day receives the rest, less the challan's short
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

    const chart = charts.get(line.tankId);
    const litresAt = (cm?: string) => (chart && cm ? dipToLitres(chart, cm) : null);

    let previous = litresAt(line.dipBeforeCm);
    const chambers = (line.chambers ?? []).map((c) => {
      const litres = num(c.litres);
      const before = c.dipBeforeCm ? litresAt(c.dipBeforeCm) : previous;
      const after = litresAt(c.dipAfterCm);
      const riseLitres = before && after ? after.minus(before) : null;
      previous = after;
      return { litres, riseLitres, shortLitres: riseLitres ? litres.minus(riseLitres) : null };
    });

    let dipRiseLitres: Decimal | null = null;
    if (chambers.length) {
      if (chambers.every((c) => c.riseLitres)) dipRiseLitres = sum(chambers.map((c) => c.riseLitres as Decimal));
    } else {
      const before = litresAt(line.dipBeforeCm);
      const after = litresAt(line.dipAfterCm);
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
      chambers,
      receivedNextDayLitres: sum((line.chambers ?? []).filter((c) => c.nextDay).map((c) => num(c.litres))),
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
