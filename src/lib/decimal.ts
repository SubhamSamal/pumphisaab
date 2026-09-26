import DecimalJs from "decimal.js";

/**
 * The only Decimal the app uses. All money and litre maths goes through this (CLAUDE.md hard rule 3).
 * High precision for working values; rounding half-up happens only when formatting for display.
 */
export const Decimal = DecimalJs.clone({ precision: 40, rounding: DecimalJs.ROUND_HALF_UP });
// eslint-disable-next-line @typescript-eslint/no-redeclare -- value and type share the name on purpose
export type Decimal = InstanceType<typeof Decimal>;

/** Money and litres arrive as strings (Postgres numeric, text inputs) or Decimals. Never JS numbers. */
export type DecimalInput = string | Decimal;

export function toDecimal(value: DecimalInput): Decimal {
  const d = new Decimal(value);
  if (!d.isFinite()) throw new Error(`Not a finite number: ${String(value)}`);
  return d;
}
