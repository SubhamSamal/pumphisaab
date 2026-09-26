// The calculation engine. Pure maths: no screens, no database (CLAUDE.md folder map).
// Start with rules.ts (every limit) and day.ts (one whole day).
export { checkChart, dipToLitres, type CheckedChart, type ChartProblem } from "./dipChart";
export { slipAmounts } from "./credit";
export { evaluateDay } from "./day";
export { explainReceived, explainSoldAsPerMeters, explainSoldAsPerTank } from "./explain";
export { nozzleSale, shiftLitres, missingReadings } from "./meters";
export { cashTotal, shiftMoney } from "./money";
export { priceFor } from "./prices";
export { DEFAULT_RULES, type Rules } from "./rules";
export { receiptTotals } from "./tanker";
export type * from "./types";
