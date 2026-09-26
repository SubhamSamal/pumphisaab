/**
 * The fuel check, per fuel for the whole day:
 *
 *   Sold as per tank    = opening dip litres + tanker litres received − closing dip litres
 *   Sold as per meters  = all shifts' meter litres − testing
 *   Difference          = sold as per meters − sold as per tank
 *
 * A negative Difference means more fuel left the tank than the meters show: a possible loss.
 * Difference % = Difference ÷ sold as per tank × 100.
 */

import type { Decimal } from "@/lib/decimal";
import { dipToLitres, type CheckedChart } from "./dipChart";
import { isBeyond, num, percentOf, sum } from "./numbers";
import type { Rules } from "./rules";
import type { Product, ProductResult, TankDay, TankerResult } from "./types";
import type { ShiftLitres } from "./meters";

type TankInfo = { id: string; product: Product; chart: CheckedChart };

/**
 * Null when the day isn't complete enough yet (a closing dip missing, or a dip outside the chart).
 */
export function productStock(
  product: Product,
  tanks: TankInfo[],
  tankDays: TankDay[],
  tankers: TankerResult[],
  shifts: ShiftLitres[],
  rules: Rules,
): ProductResult | null {
  const productTanks = tanks.filter((t) => t.product === product);
  if (productTanks.length === 0) return null;

  const openings: Decimal[] = [];
  const closings: Decimal[] = [];
  for (const tank of productTanks) {
    const day = tankDays.find((d) => d.tankId === tank.id);
    if (!day || day.closingDipCm === undefined) return null;
    const opening = dipToLitres(tank.chart, day.openingDipCm);
    const closing = dipToLitres(tank.chart, day.closingDipCm);
    if (!opening || !closing) return null;
    openings.push(opening);
    closings.push(closing);
  }

  const openingDipLitres = sum(openings);
  const closingDipLitres = sum(closings);
  const receivedLitres = sum(
    tankers.flatMap((t) => t.lines).filter((l) => l.product === product).map((l) => l.receivedNetLitres),
  );
  const soldAsPerTank = openingDipLitres.plus(receivedLitres).minus(closingDipLitres);

  const meterLitres = sum(shifts.map((s) => s.meterLitres[product]));
  const testLitres = sum(shifts.map((s) => s.testLitres[product]));
  const soldAsPerMeters = sum(shifts.map((s) => s.soldAsPerMeters[product]));

  const difference = soldAsPerMeters.minus(soldAsPerTank);
  const differencePercent = percentOf(difference, soldAsPerTank);

  // When nothing left the tank a % can't be worked out, so any litre difference counts as beyond the limit.
  const withinLimit =
    differencePercent === null
      ? difference.isZero()
      : !isBeyond(differencePercent, num(rules.stockDifference.flagBeyondPercent));

  return {
    product,
    openingDipLitres,
    receivedLitres,
    closingDipLitres,
    soldAsPerTank,
    meterLitres,
    testLitres,
    soldAsPerMeters,
    difference,
    differencePercent,
    withinLimit,
  };
}

/** R1: is the Difference beyond IOCL's allowed variation (4% + evaporation for that fuel)? */
export function beyondComplianceLimit(result: ProductResult, rules: Rules): boolean {
  if (result.differencePercent === null) return false;
  const limit = num(rules.compliance.basePercent).plus(num(rules.compliance.evaporationPercent[result.product]));
  return isBeyond(result.differencePercent, limit);
}
