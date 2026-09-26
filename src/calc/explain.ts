/**
 * The sums written out in plain numbers, so anyone can check them by hand (canvas Flow 3 and 5).
 */

import { fmtLitres, fmtRupees } from "@/lib/format";
import type { ProductResult, ShiftMoneyResult } from "./types";

/** "Opening 5,074.74 + tanker 13,972 − closing 12,749.18 = 6,297.56 L" */
export function explainSoldAsPerTank(p: ProductResult): string {
  const tanker = p.receivedLitres.isZero() ? "" : ` + tanker ${fmtLitres(p.receivedLitres).replace(" L", "")}`;
  return `Opening ${fmtLitres(p.openingDipLitres).replace(" L", "")}${tanker} − closing ${fmtLitres(p.closingDipLitres).replace(" L", "")} = ${fmtLitres(p.soldAsPerTank)}`;
}

/** "Meters 6,260.45 − testing 10 = 6,250.45 L" */
export function explainSoldAsPerMeters(p: ProductResult): string {
  if (p.testLitres.isZero()) return `Meters ${fmtLitres(p.meterLitres)}`;
  return `Meters ${fmtLitres(p.meterLitres).replace(" L", "")} − testing ${fmtLitres(p.testLitres).replace(" L", "")} = ${fmtLitres(p.soldAsPerMeters)}`;
}

/** One line per part of a shift's Received, in the order the By shift view shows them. */
export function explainReceived(s: ShiftMoneyResult): { label: string; amount: string }[] {
  const r = s.receivedParts;
  const lines: { label: string; amount: string }[] = [];
  lines.push({ label: "Cash counted", amount: fmtRupees(r.cashCounted, "input") });
  if (!r.openingCash.isZero()) lines.push({ label: "Less cash already in the drawer", amount: fmtRupees(r.openingCash.negated(), "input") });
  for (const p of r.otherPayments) lines.push({ label: p.type, amount: fmtRupees(p.amount, "input") });
  lines.push({ label: "Credit slips", amount: fmtRupees(r.creditSlips, "input") });
  if (!r.drawerExpenses.isZero()) lines.push({ label: "Cash paid out (expenses)", amount: fmtRupees(r.drawerExpenses, "input") });
  if (!r.customerPaymentsTakenOff.isZero())
    lines.push({ label: "Less customer payments (not fuel)", amount: fmtRupees(r.customerPaymentsTakenOff.negated(), "input") });
  lines.push({ label: "Received", amount: fmtRupees(s.received, "input") });
  return lines;
}
