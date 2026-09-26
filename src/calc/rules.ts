/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  ALL THE RULES, IN ONE PLACE
 * ─────────────────────────────────────────────────────────────────────────────
 *  Every limit the app uses to decide "is this OK?" lives in this file.
 *  Nothing else in the calculation engine has a number like 0.5% or ₹100 in it.
 *
 *  These are the starting values. The owner will be able to change them per pump
 *  in Profile › Pump settings › "When to flag" (Phase 6). Until then, these apply.
 *
 *  How to read a limit:
 *    "Flag beyond 0.5%" means exactly 0.5% is still OK; 0.51% raises a flag.
 *
 *  Numbers are written as text ("0.5") on purpose: the engine does exact decimal
 *  maths and never uses the computer's rounded floating-point numbers.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Product } from "./types";

export type Rules = {
  /** S1. Fuel check: sold as per meters vs sold as per tank, per fuel, per day. */
  stockDifference: {
    /** Flag when the Difference is beyond this % of "sold as per tank". */
    flagBeyondPercent: string;
  };

  /** S2. Money check: Received vs Should have, per shift. */
  shiftMoney: {
    /** Flag when a shift is short or excess by more than this many rupees. */
    flagBeyondRupees: string;
  };

  /** S3. IOCL book stock vs our opening dip. The gap between them is allowed to be old, but not to grow. */
  bookStockGap: {
    /** Flag when today's gap has moved from yesterday's gap by more than this % of the opening dip litres. */
    flagBeyondPercentOfDip: string;
  };

  /** S4. Unusual nozzle sales in a day. */
  nozzleSales: {
    /** Flag an in-use nozzle that sold nothing all day. */
    flagZeroSale: boolean;
    /** Flag a nozzle that sold more than this many times its recent daily average. */
    spikeMultiple: string;
    /** How many earlier days make up the "recent daily average". */
    historyDays: number;
    /** Don't judge spikes until at least this many earlier days exist. */
    minHistoryDays: number;
  };

  /** S6. Tanker checks. */
  tanker: {
    /** Flag when litres short on delivery are beyond this % of litres ordered. */
    shortFlagBeyondPercent: string;
    /** Flag when the dip rise after unloading differs from litres received by more than this %. */
    dipCheckFlagBeyondPercent: string;
  };

  /** S7. This morning's opening dip vs last night's closing dip. */
  openingDip: {
    /** Flag when they differ by more than this many cm. */
    flagBeyondCm: string;
  };

  /** S9. Daily caps per expense type (only the types listed here are capped). Rupees per day. */
  expenseDailyCaps: Record<string, string>;

  /** R1. IOCL compliance: stock Difference beyond the IOCL allowed variation. Shown red. */
  compliance: {
    /** IOCL's normal operational variation, % of "sold as per tank". */
    basePercent: string;
    /** Evaporation allowance per fuel, added on top (depends on yearly sales). */
    evaporationPercent: Record<Product, string>;
  };

  /** Credit slips typed in rupees: how litres are worked out. */
  creditSlip: {
    /** Litres are kept to this many decimals. */
    litreDecimals: number;
    /** "up" matches the slips on 15 Sep 2026 (₹15,000 ÷ 101.74 = 147.4346 → 147.44). */
    litreRounding: "up" | "halfUp";
  };

  /** Testing: litres poured back to the tank after a measure check. */
  testing: {
    /** Litres suggested for a new test row. */
    defaultLitres: string;
  };
};

export const DEFAULT_RULES: Rules = {
  stockDifference: { flagBeyondPercent: "0.5" },

  shiftMoney: { flagBeyondRupees: "100" },

  bookStockGap: { flagBeyondPercentOfDip: "0.5" },

  nozzleSales: { flagZeroSale: true, spikeMultiple: "2", historyDays: 7, minHistoryDays: 3 },

  tanker: { shortFlagBeyondPercent: "0.3", dipCheckFlagBeyondPercent: "0.5" },

  openingDip: { flagBeyondCm: "0.5" },

  // No caps until the owner sets them.
  expenseDailyCaps: {},

  // HSD sells above 600 KL a year (allowance 0.20%); MS below 600 KL a year (0.75%). Decision D19.
  compliance: { basePercent: "4", evaporationPercent: { HSD: "0.20", MS: "0.75" } },

  creditSlip: { litreDecimals: 2, litreRounding: "up" },

  testing: { defaultLitres: "5" },
};
