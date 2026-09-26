/**
 * Meter readings: how many litres each nozzle and each shift sold.
 *
 *   Nozzle sale            = closing reading − opening reading
 *   Sold as per meters     = all nozzle sales of a fuel − litres used for testing
 *
 * Testing fuel is poured back into the tank, so it isn't a sale.
 */

import type { Decimal } from "@/lib/decimal";
import { num, sum, ZERO } from "./numbers";
import type { NozzleReading, Product, ShiftInput } from "./types";

/** Litres one nozzle sold in a shift. Null when a reading is missing or closing is below opening (H1). */
export function nozzleSale(nozzle: NozzleReading): Decimal | null {
  if (!nozzle.inUse || nozzle.opening === undefined || nozzle.closing === undefined) return null;
  const sale = num(nozzle.closing).minus(num(nozzle.opening));
  return sale.isNegative() ? null : sale;
}

export type ShiftLitres = {
  /** Before testing. */
  meterLitres: Record<Product, Decimal>;
  testLitres: Record<Product, Decimal>;
  /** After testing: the fuel that really left the pump. */
  soldAsPerMeters: Record<Product, Decimal>;
};

export function shiftLitres(shift: ShiftInput): ShiftLitres {
  const byProduct = (product: Product, values: (Decimal | null)[]) =>
    sum(values.filter((v): v is Decimal => v !== null));

  const productOf = new Map(shift.nozzles.map((n) => [n.nozzleId, n.product]));
  const meters = (p: Product) => byProduct(p, shift.nozzles.filter((n) => n.product === p).map(nozzleSale));
  const tests = (p: Product) =>
    byProduct(
      p,
      shift.tests.filter((t) => productOf.get(t.nozzleId) === p).map((t) => num(t.litres, "0")),
    );

  const meterLitres = { MS: meters("MS"), HSD: meters("HSD") };
  const testLitres = { MS: tests("MS"), HSD: tests("HSD") };
  return {
    meterLitres,
    testLitres,
    soldAsPerMeters: {
      MS: meterLitres.MS.minus(testLitres.MS),
      HSD: meterLitres.HSD.minus(testLitres.HSD),
    },
  };
}

/** Everything a shift's nozzles are missing, e.g. to say "Type 2 more closing readings". */
export function missingReadings(shift: ShiftInput): NozzleReading[] {
  return shift.nozzles.filter((n) => n.inUse && (n.opening === undefined || n.closing === undefined));
}

export const NO_LITRES: Record<Product, Decimal> = { MS: ZERO, HSD: ZERO };
