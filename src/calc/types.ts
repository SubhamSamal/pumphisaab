/**
 * The shape of one business day going INTO the engine, and the answer coming OUT.
 *
 * Every litre, rupee, dip and meter reading is written as text ("6250.45"), exactly as typed,
 * so no precision is ever lost. The engine turns them into exact decimals itself.
 */

import type { Decimal } from "@/lib/decimal";

export type Product = "MS" | "HSD";
export type ShiftCode = "A" | "B" | "C";

/** A number written as text, e.g. "13163.73". */
export type Num = string;

// ─── Setup (owner settings) ────────────────────────────────────────────────

/** One row of a tank's dip chart: dip in cm → litres. */
export type DipChartRow = { dipCm: Num; litres: Num };

export type Tank = {
  id: string;
  label: string; // "HSD-1"
  product: Product;
  chart: DipChartRow[];
};

/** A fuel price with the date it starts from (only the owner adds these). */
export type Price = { product: Product; perLitre: Num; startsOn: string /* YYYY-MM-DD */ };

// ─── Things the manager enters for the day ─────────────────────────────────

export type TankDay = {
  tankId: string;
  openingDipCm: Num;
  closingDipCm?: Num; // missing until the end of the day
  /** "Op. Stock" from the IOCL book (DSR), if written down. */
  bookStockLitres?: Num;
  /** Yesterday's closing dip, for S7. */
  yesterdayClosingDipCm?: Num;
  /** Yesterday's gap (book stock − opening dip litres), for S3. */
  yesterdayBookGapLitres?: Num;
};

export type TankerLine = {
  product: Product;
  tankId: string;
  orderedLitres: Num; // litres on the invoice
  shortLitres: Num; // litres short on delivery ("0" if none)
  pricePerLitre?: Num; // cost price from the invoice (selling price − margin)
  marginPerLitre?: Num; // profit per litre
  dipBeforeCm?: Num; // our tank's dip just before unloading
  dipAfterCm?: Num; // our tank's dip just after unloading (after the last chamber)
  /**
   * Chamber by chamber (owner, 27 Sep): the chamber's litres from the challan and our tank's dip
   * after that chamber is emptied. The first chamber's "before" is dipBeforeCm; each next one's
   * "before" is the previous chamber's "after".
   */
  chambers?: { litres: Num; dipAfterCm: Num }[];
};

export type TankerReceipt = {
  id: string;
  vehicleNo: string;
  invoiceNo?: string;
  /** The challan's total, as typed. When given, To pay = this − short amount. */
  invoiceAmount?: Num;
  lines: TankerLine[];
};

export type NozzleReading = {
  nozzleId: string;
  label: string; // "HSD-3"
  product: Product;
  tankId: string;
  inUse: boolean; // nozzles not in use need no reading and raise no flags
  opening?: Num;
  closing?: Num;
  /** The closing reading of the same nozzle in the previous shift, for H2. */
  previousClosing?: Num;
  /** Owner approved a meter change (repair/replacement), so opening may differ from previous closing. */
  meterChangeApproved?: boolean;
};

export type TestPour = { nozzleId: string; litres: Num };

/** Cash counted in the drawer at the end of the shift. */
export type CashCount =
  | { byNotes: { noteValue: Num; count: Num }[]; coins: Num }
  /** Only for importing old notebook days, where notes weren't written down. */
  | { total: Num };

/** Paytm, Card, XtraPower, Bank transfer… one total per shift from the machine/app. */
export type OtherPayment = { type: string; amount: Num };

/** A credit slip, typed in rupees (round fill) or in litres. */
export type CreditSlip = {
  slipNo: string;
  customer: string;
  vehicleNo: string;
  product: Product;
  entry: { by: "rupees"; rupees: Num } | { by: "litres"; litres: Num };
};

export type ShiftInput = {
  code: ShiftCode;
  nozzles: NozzleReading[];
  tests: TestPour[];
  /** Cash already in the drawer when the shift started. */
  openingCash: Num;
  cash?: CashCount;
  otherPayments: OtherPayment[];
  creditSlips: CreditSlip[];
};

export type PaidFrom = `SHIFT_${ShiftCode}` | "OWNER" | "BANK";

export type Expense = {
  id: string;
  type: string; // "Tiffin", "DG rent", "Cash advance to credit customer" …
  rupees: Num;
  paidFrom: PaidFrom;
};

/** A customer paying old dues or an advance. Not a fuel sale. */
export type CustomerPayment = {
  customer: string;
  rupees: Num;
  /** "Cash", or the same name as an OtherPayment type ("XtraPower", "Bank transfer" …). */
  method: string;
  /**
   * The shift whose total already holds this money, so it is taken off that shift (D47): dues paid
   * by Cash, Paytm, Card or XtraPower. Dues paid by bank transfer come outside every shift: no shift.
   */
  shift?: ShiftCode;
};

export type DayInput = {
  businessDate: string; // YYYY-MM-DD
  priceConfirmed: boolean;
  prices: Price[]; // full price history; the engine picks the right one for the day
  tanks: Tank[];
  tankDays: TankDay[];
  tankers: TankerReceipt[];
  shifts: ShiftInput[];
  expenses: Expense[];
  customerPayments: CustomerPayment[];
  /** Slip numbers already used on earlier days, for H7. */
  earlierSlipNumbers?: string[];
  /** Litres each nozzle sold on earlier days (most recent last), for S4. */
  nozzleHistory?: Record<string, Num[]>;
  /** Which Today sections are done, for H4. */
  sectionsDone?: Record<string, boolean>;
};

// ─── The answer ───────────────────────────────────────────────────────────

export type Severity = "hard" | "soft" | "compliance";

/** A hard error (blocks submit) or a flag for the owner (never blocks). */
export type Issue = {
  code: string; // "H1", "S1", "R1" …
  severity: Severity;
  /** Plain English: what's off and what to do. */
  message: string;
  /** Where it is, so a screen can point at it. */
  where?: { shift?: ShiftCode; nozzleId?: string; tankId?: string; product?: Product; slipNo?: string };
  /** The numbers behind it (exact). */
  numbers?: Record<string, Decimal>;
};

export type ProductResult = {
  product: Product;
  openingDipLitres: Decimal;
  receivedLitres: Decimal;
  closingDipLitres: Decimal;
  soldAsPerTank: Decimal;
  meterLitres: Decimal; // before testing
  testLitres: Decimal;
  soldAsPerMeters: Decimal; // after testing
  /** Sold as per meters − sold as per tank. Negative = more left the tank than the meters show (possible loss). */
  difference: Decimal;
  /** Difference as % of sold as per tank; null when nothing left the tank. */
  differencePercent: Decimal | null;
  withinLimit: boolean;
};

export type ShiftMoneyResult = {
  shift: ShiftCode;
  /** Litres sold as per meters in this shift, per fuel (after testing). */
  litres: Record<Product, Decimal>;
  shouldHave: Decimal;
  received: Decimal;
  /** The parts of Received, for the "By shift" view. */
  receivedParts: {
    cashCounted: Decimal;
    openingCash: Decimal;
    otherPayments: { type: string; amount: Decimal }[];
    creditSlips: Decimal;
    drawerExpenses: Decimal;
    customerPaymentsTakenOff: Decimal;
  };
  /** Received − Should have. Negative = short. */
  difference: Decimal;
  withinLimit: boolean;
};

export type TankerLineResult = {
  product: Product;
  tankId: string;
  receivedNetLitres: Decimal;
  amount: Decimal | null;
  shortAmount: Decimal | null;
  margin: Decimal | null;
  dipRiseLitres: Decimal | null;
  /** Per chamber: how much the tank went up, and the chamber's short (its litres − that rise). */
  chambers: { litres: Decimal; riseLitres: Decimal | null; shortLitres: Decimal | null }[];
};

export type TankerResult = {
  id: string;
  lines: TankerLineResult[];
  /** Σ ordered × price per litre (price = selling − margin). */
  totalAmount: Decimal | null;
  /** The invoice amount typed from the challan, if any. */
  invoiceAmount: Decimal | null;
  totalShortAmount: Decimal | null;
  /** Invoice amount (typed, else worked out) − short amount. */
  toPay: Decimal | null;
  totalMargin: Decimal | null;
};

export type DayResult = {
  prices: Partial<Record<Product, Decimal>>;
  products: ProductResult[];
  shifts: ShiftMoneyResult[];
  tankers: TankerResult[];
  hardErrors: Issue[];
  flags: Issue[];
  /** Every fuel and every shift within the limits, and no hard errors. */
  isMatched: boolean;
};
