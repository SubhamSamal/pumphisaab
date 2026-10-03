/**
 * Reading and saving a business day (Phase 4). Every save goes through Supabase with Row Level
 * Security and the database's own checks (H3, H5, locked days); the screens only follow.
 *
 * Numbers are read as text (`::text`) so no litre or rupee ever passes through a floating-point
 * number (hard rule 3).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_RULES, type DipChartRow, type Price, type Product, type Rules } from "@/calc";
import { addDays } from "@/lib/businessDay";
import { friendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { countUses } from "./customers";
import { registerOutboxRunner, saveOrQueue, useOutbox, useWaiting } from "./Outbox";
import { overlayReadings, overlaySales, overlayShiftData } from "./outboxOverlay";

// ─── Setup the day needs (tanks, charts, prices, rules) ───────────────────
export type SetupTank = { id: string; label: string; product: Product; chartId: string; isActive: boolean };
export type SetupNozzle = { id: string; label: string; product: Product; tankId: string; inUse: boolean };
/** An owner price row with its dealer margin (owner sets both, D64). */
export type PriceRow = { id: string; product: Product; perLitre: string; startsOn: string; margin: string | null };
/** An expense type (D33): Salary, Tiffin … Other. A daily limit makes S9 flag it (D72: none yet). */
export type ExpenseType = { id: string; name: string; defaultType: "FIXED" | "VARIABLE"; dailyCap: string | null; uses: number };
export type DaySetup = {
  tanks: SetupTank[];
  expenseTypes: ExpenseType[];
  priceRows: PriceRow[];
  /** In the order the pump lists them (HSD-3, HSD-4 …). */
  nozzles: SetupNozzle[];
  charts: Record<string, DipChartRow[]>;
  prices: Price[];
  rules: Rules;
  firstBusinessDate: string | null;
};

export function useDaySetup(pumpId: string) {
  return useQuery({
    queryKey: ["daySetup", pumpId],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<DaySetup> => {
      const [pump, tanks, prices, nozzles, expenseTypes, recentExpenses] = await Promise.all([
        supabase.from("pumps").select("rules, first_business_date").eq("id", pumpId).single(),
        supabase.from("tanks").select("id, label, product, chart_id, is_active").eq("pump_id", pumpId).order("product").order("label"),
        supabase.from("fuel_prices").select("id, product, per_litre::text, starts_on, margin_per_l::text").eq("pump_id", pumpId),
        supabase.from("nozzles").select("id, label, product, tank_id, in_use").eq("pump_id", pumpId).order("sort_order").order("label"),
        supabase
          .from("expense_categories")
          .select("id, name, default_type, daily_cap::text")
          .eq("pump_id", pumpId)
          .eq("is_active", true)
          .order("sort_order"),
        // The latest expenses, to show the most used types first (D68).
        supabase.from("expenses").select("category_id").eq("pump_id", pumpId).order("created_at", { ascending: false }).limit(300),
      ]);
      if (expenseTypes.error) throw expenseTypes.error;
      if (recentExpenses.error) throw recentExpenses.error;
      const typeUses = countUses(recentExpenses.data.map((e) => e.category_id as string));
      if (nozzles.error) throw nozzles.error;
      if (pump.error) throw pump.error;
      if (tanks.error) throw tanks.error;
      if (prices.error) throw prices.error;

      const chartIds = [...new Set(tanks.data.map((t) => t.chart_id as string))];
      const rows = await supabase
        .from("dip_chart_rows")
        .select("chart_id, dip_cm::text, volume_l::text")
        .in("chart_id", chartIds)
        .order("dip_cm")
        .limit(5000);
      if (rows.error) throw rows.error;
      const charts: Record<string, DipChartRow[]> = {};
      for (const r of rows.data) (charts[r.chart_id] ??= []).push({ dipCm: r.dip_cm, litres: r.volume_l });

      return {
        tanks: tanks.data.map((t) => ({ id: t.id, label: t.label, product: t.product, chartId: t.chart_id, isActive: t.is_active })),
        nozzles: nozzles.data.map((n) => ({ id: n.id, label: n.label, product: n.product, tankId: n.tank_id, inUse: n.in_use })),
        charts,
        prices: prices.data.map((p) => ({ product: p.product, perLitre: p.per_litre, startsOn: p.starts_on })),
        priceRows: prices.data.map((p) => ({ id: p.id, product: p.product, perLitre: p.per_litre, startsOn: p.starts_on, margin: p.margin_per_l })),
        expenseTypes: expenseTypes.data.map((e) => ({ id: e.id, name: e.name, defaultType: e.default_type, dailyCap: e.daily_cap, uses: typeUses[e.id] ?? 0 })),
        // Same shape as src/calc/rules.ts (the seed test keeps them in step); defaults fill any gap.
        // S9 limits live on the expense types (one place, same as the database's v_expense_caps).
        rules: {
          ...DEFAULT_RULES,
          ...(pump.data.rules as Partial<Rules>),
          expenseDailyCaps: Object.fromEntries(expenseTypes.data.filter((e) => e.daily_cap !== null).map((e) => [e.name, e.daily_cap as string])),
        },
        firstBusinessDate: pump.data.first_business_date,
      };
    },
  });
}

// ─── The day itself ───────────────────────────────────────────────────────
export type DayStatus = "DRAFT" | "SUBMITTED" | "LOCKED";
export type Day = {
  id: string;
  businessDate: string;
  status: DayStatus;
  isLocked: boolean;
  ownerOpened: boolean;
  /** Prices the manager confirmed, and the owner's prices for this date now. */
  confirmed: Partial<Record<Product, string>>;
  now: Partial<Record<Product, string>>;
  priceConfirmed: boolean;
  noTanker: boolean;
  noExpenses: boolean;
  /** Stored by submit_day (null until submitted). */
  isMatched: boolean | null;
  submittedAt: string | null;
  version: number;
};

const DAY_COLUMNS =
  "id, business_date, status, is_locked, owner_opened, ms_price::text, hsd_price::text, ms_price_now::text, hsd_price_now::text, price_confirmed, no_tanker, no_expenses, is_matched, submitted_at, version";

type DayRow = {
  id: string;
  business_date: string;
  status: DayStatus;
  is_locked: boolean;
  owner_opened: boolean;
  ms_price: string | null;
  hsd_price: string | null;
  ms_price_now: string | null;
  hsd_price_now: string | null;
  price_confirmed: boolean;
  no_tanker: boolean;
  no_expenses: boolean;
  is_matched: boolean | null;
  submitted_at: string | null;
  version: number;
};

function toDay(r: DayRow): Day {
  const pick = (ms: string | null, hsd: string | null) => ({ ...(ms ? { MS: ms } : {}), ...(hsd ? { HSD: hsd } : {}) });
  return {
    id: r.id,
    businessDate: r.business_date,
    status: r.status,
    isLocked: r.is_locked,
    ownerOpened: r.owner_opened,
    confirmed: pick(r.ms_price, r.hsd_price),
    now: pick(r.ms_price_now, r.hsd_price_now),
    priceConfirmed: r.price_confirmed,
    noTanker: r.no_tanker,
    noExpenses: r.no_expenses,
    isMatched: r.is_matched,
    submittedAt: r.submitted_at,
    version: r.version,
  };
}

/** Opens the day (creating it the first time; safe to repeat) and reads it. */
export function useDay(pumpId: string, date: string | undefined) {
  return useQuery({
    queryKey: ["day", pumpId, date],
    enabled: Boolean(date),
    queryFn: async (): Promise<Day> => {
      const opened = await supabase.rpc("open_day", { p_pump: pumpId, p_date: date });
      if (opened.error) throw new Error(friendlyError(opened.error, "Couldn't open the day. Try again."));
      const { data, error } = await supabase.from("v_business_days").select(DAY_COLUMNS).eq("id", opened.data).single();
      if (error) throw error;
      return toDay(data as unknown as DayRow);
    },
  });
}

/** Yesterday and the day before (D49 banners): which of them aren't submitted yet. */
export function useRecentDays(pumpId: string, today: string | undefined) {
  return useQuery({
    queryKey: ["recentDays", pumpId, today],
    enabled: Boolean(today),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_days")
        .select("business_date, status")
        .eq("pump_id", pumpId)
        .gte("business_date", addDays(today as string, -2))
        .lt("business_date", today as string);
      if (error) throw error;
      return data as { business_date: string; status: DayStatus }[];
    },
  });
}

// ─── Tank readings (opening and closing dip) ──────────────────────────────
export type ReadingType = "OPENING" | "CLOSING";
export type TankReading = {
  id: string;
  tankId: string;
  type: ReadingType;
  dipCm: string | null;
  bookStockLitres: string | null;
  version: number;
};
/** What the database knows about yesterday, per tank (for S3 and S7). */
export type TankYesterday = { tankId: string; closingDipCm: string | null; bookGapLitres: string | null };

export function useTankReadings(dayId: string | undefined) {
  const waiting = useWaiting("tankReading", dayId);
  return useQuery({
    queryKey: ["tankReadings", dayId],
    enabled: Boolean(dayId),
    // Saves waiting in the outbox (no internet) show on top of what was loaded (D70).
    select: (data) => (waiting.length ? { ...data, readings: overlayReadings(data.readings, waiting) } : data),
    queryFn: async () => {
      const [readings, yesterday] = await Promise.all([
        supabase.from("tank_readings").select("id, tank_id, reading_type, dip_cm::text, book_stock_l::text, version").eq("day_id", dayId as string),
        supabase.from("v_tank_day").select("tank_id, yesterday_closing_dip_cm::text, yesterday_book_gap_l::text").eq("day_id", dayId as string),
      ]);
      if (readings.error) throw readings.error;
      if (yesterday.error) throw yesterday.error;
      return {
        readings: readings.data.map(
          (r): TankReading => ({
            id: r.id,
            tankId: r.tank_id,
            type: r.reading_type,
            dipCm: r.dip_cm,
            bookStockLitres: r.book_stock_l,
            version: r.version,
          }),
        ),
        yesterday: yesterday.data.map(
          (y): TankYesterday => ({ tankId: y.tank_id, closingDipCm: y.yesterday_closing_dip_cm, bookGapLitres: y.yesterday_book_gap_l }),
        ),
      };
    },
  });
}

/**
 * Saves one tank's dip (and IOCL report stock). Keyed by day + tank + opening/closing, so saving
 * twice never makes two rows. Sends the version it read: if someone else saved in between, the
 * database refuses instead of overwriting.
 */
export type TankReadingSave = { tankId: string; type: ReadingType; dipCm: string | null; bookStockLitres: string | null; version?: number };

async function sendTankReading({ pumpId, dayId, ...input }: TankReadingSave & { pumpId: string; dayId: string }) {
  const { error } = await supabase.from("tank_readings").upsert(
    {
      pump_id: pumpId,
      day_id: dayId,
      tank_id: input.tankId,
      reading_type: input.type,
      dip_cm: input.dipCm,
      book_stock_l: input.type === "OPENING" ? input.bookStockLitres : null,
      ...(input.version ? { version: input.version } : {}),
    },
    { onConflict: "day_id,tank_id,reading_type" },
  );
  if (error) throw new Error(friendlyError(error, "Couldn't save. Try again."), { cause: error });
}
registerOutboxRunner("tankReading", (i) => sendTankReading(i as TankReadingSave & { pumpId: string; dayId: string }));

/**
 * Saves one tank's dip (and IOCL report stock). Keyed by day + tank + opening/closing, so saving
 * twice never makes two rows. Sends the version it read: if someone else saved in between, the
 * database refuses instead of overwriting. With no internet it waits in the outbox (D70; sent
 * later without the version: the latest save wins, D71).
 */
export function useSaveTankReading(pumpId: string, dayId: string | undefined) {
  const qc = useQueryClient();
  const box = useOutbox();
  return useMutation({
    mutationKey: ["save", "tankReading"],
    mutationFn: (input: TankReadingSave) =>
      saveOrQueue(
        box,
        { kind: "tankReading", key: `tankReading:${dayId}:${input.tankId}:${input.type}`, dayId: dayId as string, input: { ...input, version: undefined, pumpId, dayId } },
        () => sendTankReading({ ...input, pumpId, dayId: dayId as string }),
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: ["tankReadings", dayId] }),
  });
}

// ─── Day actions ──────────────────────────────────────────────────────────
function useDayAction(pumpId: string, fn: "confirm_prices" | "lock_day" | "unlock_day") {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["save", fn],
    mutationFn: async (dayId: string) => {
      const { error } = await supabase.rpc(fn, { p_day: dayId });
      if (error) throw new Error(friendlyError(error, "Couldn't save. Try again."), { cause: error });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["day", pumpId] });
      qc.invalidateQueries({ queryKey: ["recentDays", pumpId] });
    },
  });
}

export const useConfirmPrices = (pumpId: string) => useDayAction(pumpId, "confirm_prices");
export const useLockDay = (pumpId: string) => useDayAction(pumpId, "lock_day");
export const useUnlockDay = (pumpId: string) => useDayAction(pumpId, "unlock_day");

// ─── Shifts: meters, attendants, testing (slice 4b) ───────────────────────
export type Shift = {
  id: string;
  code: string;
  startsAt: string;
  endsAt: string;
  /** Cash in the drawer at the start, if typed (else the previous shift's count is used, D46). */
  openingCash: string | null;
  salesDoneAt: string | null;
};
export type MeterChange = "NONE" | "PENDING" | "APPROVED";
/** One in-use nozzle in one shift, saved or not yet (from v_nozzle_readings). */
export type NozzleLine = {
  shiftId: string;
  nozzleId: string;
  readingId: string | null;
  version: number | null;
  opening: string | null;
  openingTyped: boolean;
  closing: string | null;
  meterChange: MeterChange;
  /** Whether any shift came before this one (false on the very first shift in the app). */
  hasPrevious: boolean;
  previousClosing: string | null;
};
export type Attendant = { id: string; shiftId: string; staffId: string };
export type Test = { id: string; shiftId: string; nozzleId: string; litres: string; version: number };
export type ShiftData = { shifts: Shift[]; lines: NozzleLine[]; attendants: Attendant[]; tests: Test[] };

export function useShiftData(dayId: string | undefined) {
  const readings = useWaiting("nozzleReading", dayId);
  const cash = useWaiting("openingCash", dayId);
  return useQuery({
    queryKey: ["shiftData", dayId],
    enabled: Boolean(dayId),
    select: (data) => (readings.length || cash.length ? overlayShiftData(data, [...readings, ...cash]) : data),
    queryFn: async (): Promise<ShiftData> => {
      const id = dayId as string;
      const [shifts, lines, attendants, tests] = await Promise.all([
        supabase.from("shifts").select("id, shift_code, starts_at, ends_at, opening_cash::text, sales_done_at").eq("day_id", id).order("starts_at"),
        supabase
          .from("v_nozzle_readings")
          .select(
            "shift_id, nozzle_id, reading_id, version, opening::text, opening_typed, closing::text, meter_change_status, has_previous, previous_closing::text",
          )
          .eq("day_id", id),
        supabase.from("shift_attendants").select("id, shift_id, staff_id").eq("day_id", id),
        supabase.from("nozzle_tests").select("id, shift_id, nozzle_id, litres::text, version").eq("day_id", id).order("created_at"),
      ]);
      for (const r of [shifts, lines, attendants, tests]) if (r.error) throw r.error;
      return {
        shifts: shifts.data!.map((s) => ({
          id: s.id,
          code: s.shift_code,
          startsAt: s.starts_at,
          endsAt: s.ends_at,
          openingCash: s.opening_cash,
          salesDoneAt: s.sales_done_at,
        })),
        lines: lines.data!.map(
          (l): NozzleLine => ({
            shiftId: l.shift_id,
            nozzleId: l.nozzle_id,
            readingId: l.reading_id,
            version: l.version,
            opening: l.opening,
            openingTyped: Boolean(l.opening_typed),
            closing: l.closing,
            meterChange: (l.meter_change_status ?? "NONE") as MeterChange,
            hasPrevious: l.has_previous,
            previousClosing: l.previous_closing,
          }),
        ),
        attendants: attendants.data!.map((a) => ({ id: a.id, shiftId: a.shift_id, staffId: a.staff_id })),
        tests: tests.data!.map((t) => ({ id: t.id, shiftId: t.shift_id, nozzleId: t.nozzle_id, litres: t.litres, version: t.version })),
      };
    },
  });
}

function useShiftSave<T>(dayId: string | undefined, key: string, fn: (input: T) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["save", key],
    mutationFn: fn,
    onSettled: () => qc.invalidateQueries({ queryKey: ["shiftData", dayId] }),
  });
}

async function check<T extends { error: unknown }>(p: PromiseLike<T>) {
  const { error } = await p;
  if (error) throw new Error(friendlyError(error, "Couldn't save. Try again."), { cause: error });
}

export type NozzleReadingSave = { shiftId: string; nozzleId: string; closing?: string | null; opening?: string | null; openingTyped?: boolean; version?: number | null };

async function sendNozzleReading({ pumpId, dayId, ...input }: NozzleReadingSave & { pumpId: string; dayId: string }) {
  await check(
    supabase.from("nozzle_readings").upsert(
      {
        pump_id: pumpId,
        day_id: dayId,
        shift_id: input.shiftId,
        nozzle_id: input.nozzleId,
        ...(input.closing !== undefined ? { closing: input.closing } : {}),
        ...(input.openingTyped !== undefined ? { opening_typed: input.openingTyped, opening: input.openingTyped ? input.opening : null } : {}),
        ...(input.version ? { version: input.version } : {}),
      },
      { onConflict: "shift_id,nozzle_id" },
    ),
  );
}
registerOutboxRunner("nozzleReading", (i) => sendNozzleReading(i as NozzleReadingSave & { pumpId: string; dayId: string }));

/**
 * Saves a closing reading, or a typed opening (meter change / first reading). The database copies
 * the opening from the previous closing unless `openingTyped`. Keyed by shift + nozzle (safe to
 * repeat). With no internet it waits in the outbox (D70).
 */
export function useSaveNozzleReading(pumpId: string, dayId: string | undefined) {
  const box = useOutbox();
  return useShiftSave(dayId, "nozzleReading", (input: NozzleReadingSave) =>
    saveOrQueue(
      box,
      {
        kind: "nozzleReading",
        key: `nozzleReading:${input.shiftId}:${input.nozzleId}:${input.closing !== undefined ? "c" : ""}${input.openingTyped !== undefined ? "o" : ""}`,
        dayId: dayId as string,
        input: { ...input, version: undefined, pumpId, dayId },
      },
      () => sendNozzleReading({ ...input, pumpId, dayId: dayId as string }),
    ),
  );
}

export function useSetAttendant(pumpId: string, dayId: string | undefined) {
  return useShiftSave(dayId, "attendant", async (input: { shiftId: string; staffId: string; on: boolean; attendantId?: string }) => {
    if (input.on) {
      await check(
        supabase
          .from("shift_attendants")
          .upsert({ pump_id: pumpId, day_id: dayId, shift_id: input.shiftId, staff_id: input.staffId }, { onConflict: "shift_id,staff_id", ignoreDuplicates: true }),
      );
    } else if (input.attendantId) {
      await check(supabase.from("shift_attendants").delete().eq("id", input.attendantId));
    }
  });
}

/** Adds or changes one test (id made on the phone, so a retry never adds it twice). */
export function useSaveTest(pumpId: string, dayId: string | undefined) {
  return useShiftSave(dayId, "test", (input: { id: string; shiftId: string; nozzleId: string; litres: string; version?: number }) =>
    check(
      supabase.from("nozzle_tests").upsert(
        {
          id: input.id,
          pump_id: pumpId,
          day_id: dayId,
          shift_id: input.shiftId,
          nozzle_id: input.nozzleId,
          litres: input.litres,
          ...(input.version ? { version: input.version } : {}),
        },
        { onConflict: "id" },
      ),
    ),
  );
}

export function useDeleteTest(dayId: string | undefined) {
  return useShiftSave(dayId, "testDelete", (id: string) => check(supabase.from("nozzle_tests").delete().eq("id", id)));
}

export function useApproveMeterChange(dayId: string | undefined) {
  return useShiftSave(dayId, "approveMeter", (readingId: string) => check(supabase.rpc("approve_meter_change", { p_reading: readingId })));
}

// ─── Tankers (slice 4c) ───────────────────────────────────────────────────
export type ReceiptLine = {
  id: string;
  product: Product;
  tankId: string;
  orderedLitres: string;
  shortLitres: string;
  pricePerLitre: string | null;
  marginPerLitre: string | null;
  dipBeforeCm: string | null;
  dipAfterCm: string | null;
  /** Chamber by chamber: litres and our tank's dip before and after it (in order); nextDay = unloaded after 6 AM the next day (D97). */
  chambers: { litres: string; dipBeforeCm: string | null; dipAfterCm: string; nextDay: boolean }[];
};
export type Receipt = {
  id: string;
  dayId: string;
  businessDate: string;
  vehicleNo: string;
  invoiceNo: string | null;
  invoiceDate: string | null;
  /** The challan's total, as typed. */
  invoiceAmount: string | null;
  lines: ReceiptLine[];
};

const RECEIPT_COLUMNS =
  "id, day_id, vehicle_no, invoice_no, invoice_date, invoice_amount::text, created_at, day:business_days(business_date), lines:receipt_lines(id, product, tank_id, ordered_l::text, short_l::text, price_per_l::text, margin_per_l::text, dip_before_cm::text, dip_after_cm::text, chambers:receipt_chambers(chamber_no, litres::text, dip_before_cm::text, dip_after_cm::text, next_day))";

type ReceiptRow = {
  id: string;
  day_id: string;
  vehicle_no: string;
  invoice_no: string | null;
  invoice_date: string | null;
  invoice_amount: string | null;
  day: { business_date: string } | null;
  lines: {
    id: string;
    product: Product;
    tank_id: string;
    ordered_l: string;
    short_l: string;
    price_per_l: string | null;
    margin_per_l: string | null;
    dip_before_cm: string | null;
    dip_after_cm: string | null;
    chambers: { chamber_no: number; litres: string; dip_before_cm: string | null; dip_after_cm: string; next_day: boolean }[];
  }[];
};

function toReceipt(r: ReceiptRow): Receipt {
  return {
    id: r.id,
    dayId: r.day_id,
    businessDate: r.day?.business_date ?? "",
    vehicleNo: r.vehicle_no,
    invoiceNo: r.invoice_no,
    invoiceDate: r.invoice_date,
    invoiceAmount: r.invoice_amount,
    lines: r.lines
      .map((l) => ({
        id: l.id,
        product: l.product,
        tankId: l.tank_id,
        orderedLitres: l.ordered_l,
        shortLitres: l.short_l,
        pricePerLitre: l.price_per_l,
        marginPerLitre: l.margin_per_l,
        dipBeforeCm: l.dip_before_cm,
        dipAfterCm: l.dip_after_cm,
        chambers: [...(l.chambers ?? [])]
          .sort((a, b) => a.chamber_no - b.chamber_no)
          .map((c) => ({ litres: c.litres, dipBeforeCm: c.dip_before_cm, dipAfterCm: c.dip_after_cm, nextDay: Boolean(c.next_day) })),
      }))
      .sort((a, b) => (a.product === "HSD" ? -1 : 1) - (b.product === "HSD" ? -1 : 1)),
  };
}

/** Tankers unloaded on this business day. */
export function useTankers(dayId: string | undefined) {
  return useQuery({
    queryKey: ["tankers", dayId],
    enabled: Boolean(dayId),
    queryFn: async () => {
      const { data, error } = await supabase.from("tanker_receipts").select(RECEIPT_COLUMNS).eq("day_id", dayId as string).order("created_at");
      if (error) throw error;
      return (data as unknown as ReceiptRow[]).map(toReceipt);
    },
  });
}

/**
 * Yesterday's tankers that finished unloading today (D97): only those with "next day" chambers.
 * Their chambers count as received today.
 */
export function useTankersFromYesterday(pumpId: string, date: string | undefined) {
  return useQuery({
    queryKey: ["tankersFromYesterday", pumpId, date],
    enabled: Boolean(date),
    queryFn: async () => {
      const yesterday = await supabase.from("business_days").select("id").eq("pump_id", pumpId).eq("business_date", addDays(date as string, -1)).maybeSingle();
      if (yesterday.error) throw yesterday.error;
      if (!yesterday.data) return [] as Receipt[];
      const { data, error } = await supabase.from("tanker_receipts").select(RECEIPT_COLUMNS).eq("day_id", yesterday.data.id).order("created_at");
      if (error) throw error;
      return (data as unknown as ReceiptRow[]).map(toReceipt).filter((r) => r.lines.some((l) => l.chambers.some((c) => c.nextDay)));
    },
  });
}

/** The latest tankers at the pump (any day): the "Earlier" list, and price/margin to prefill. */
export function useRecentTankers(pumpId: string) {
  return useQuery({
    queryKey: ["recentTankers", pumpId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tanker_receipts")
        .select(RECEIPT_COLUMNS)
        .eq("pump_id", pumpId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data as unknown as ReceiptRow[]).map(toReceipt);
    },
  });
}

/**
 * Saves a whole tanker: the receipt, its lines, and removes lines for a fuel that's no longer on
 * it. Ids are made on the phone, so saving twice after a network drop never adds a second tanker.
 */
export function useSaveTanker(pumpId: string, dayId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["save", "tanker"],
    mutationFn: async (input: { receipt: Omit<Receipt, "dayId" | "businessDate" | "lines">; lines: ReceiptLine[]; removeLineIds: string[] }) => {
      await check(
        supabase.from("tanker_receipts").upsert(
          {
            id: input.receipt.id,
            pump_id: pumpId,
            day_id: dayId,
            vehicle_no: input.receipt.vehicleNo,
            invoice_no: input.receipt.invoiceNo,
            invoice_date: input.receipt.invoiceDate,
            invoice_amount: input.receipt.invoiceAmount,
          },
          { onConflict: "id" },
        ),
      );
      if (input.removeLineIds.length) await check(supabase.from("receipt_lines").delete().in("id", input.removeLineIds));
      if (input.lines.length) {
        await check(
          supabase.from("receipt_lines").upsert(
            input.lines.map((l) => ({
              id: l.id,
              pump_id: pumpId,
              day_id: dayId,
              receipt_id: input.receipt.id,
              product: l.product,
              tank_id: l.tankId,
              ordered_l: l.orderedLitres,
              short_l: l.shortLitres,
              price_per_l: l.pricePerLitre,
              margin_per_l: l.marginPerLitre,
              dip_before_cm: l.dipBeforeCm,
              dip_after_cm: l.dipAfterCm,
            })),
            { onConflict: "id" },
          ),
        );
        // Chambers: written fresh for each line (a line's chambers are one list typed together).
        const lineIds = input.lines.map((l) => l.id);
        await check(supabase.from("receipt_chambers").delete().in("receipt_line_id", lineIds));
        const chamberRows = input.lines.flatMap((l) =>
          l.chambers.map((c, k) => ({
            pump_id: pumpId,
            day_id: dayId,
            receipt_line_id: l.id,
            chamber_no: k + 1,
            litres: c.litres,
            dip_before_cm: c.dipBeforeCm,
            dip_after_cm: c.dipAfterCm,
            next_day: c.nextDay,
          })),
        );
        if (chamberRows.length) await check(supabase.from("receipt_chambers").insert(chamberRows));
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["tankers", dayId] });
      qc.invalidateQueries({ queryKey: ["recentTankers", pumpId] });
      qc.invalidateQueries({ queryKey: ["tankersFromYesterday", pumpId] });
    },
  });
}

export function useDeleteTanker(pumpId: string, dayId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["save", "tankerDelete"],
    mutationFn: (id: string) => check(supabase.from("tanker_receipts").delete().eq("id", id)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["tankers", dayId] });
      qc.invalidateQueries({ queryKey: ["recentTankers", pumpId] });
    },
  });
}


// ─── Sales (slice 4d) ─────────────────────────────────────────────────────
export type PaymentType = { id: string; name: string; kind: "CASH" | "CREDIT" | "OTHER" };
export type Denomination = { id: string; value: string };
export type Customer = { id: string; name: string; isActive: boolean; uses: number };
export type SalesSetup = { types: PaymentType[]; notes: Denomination[]; customers: Customer[] };

export function useSalesSetup(pumpId: string) {
  return useQuery({
    queryKey: ["salesSetup", pumpId],
    queryFn: async (): Promise<SalesSetup> => {
      const [types, notes, customers, slipUse, paymentUse] = await Promise.all([
        supabase.from("payment_types").select("id, name, kind").eq("pump_id", pumpId).eq("is_active", true).order("sort_order"),
        supabase.from("cash_denominations").select("id, value::text").eq("pump_id", pumpId).eq("is_active", true).order("value", { ascending: false }),
        supabase.from("credit_customers").select("id, name, is_active").eq("pump_id", pumpId).order("name"),
        // The latest slips and payments, to show the most used companies first (D68).
        supabase.from("credit_sales").select("customer_id").eq("pump_id", pumpId).order("created_at", { ascending: false }).limit(300),
        supabase.from("customer_payments").select("customer_id").eq("pump_id", pumpId).order("created_at", { ascending: false }).limit(100),
      ]);
      for (const r of [types, notes, customers, slipUse, paymentUse]) if (r.error) throw r.error;
      const uses = countUses([...slipUse.data!, ...paymentUse.data!].map((r) => r.customer_id as string));
      return {
        types: types.data as PaymentType[],
        notes: notes.data!.map((n) => ({ id: n.id, value: n.value })),
        customers: customers.data!.map((c) => ({ id: c.id, name: c.name, isActive: c.is_active, uses: uses[c.id] ?? 0 })),
      };
    },
  });
}

export type ShiftPayment = { id: string; shiftId: string; typeId: string; amount: string | null; coins: string | null };
export type NoteCount = { id: string; shiftId: string; noteId: string; count: number };
export type CreditSale = {
  id: string;
  shiftId: string;
  customerId: string;
  vehicleNo: string;
  slipNo: string;
  product: Product;
  entryBy: "RUPEES" | "LITRES";
  rupees: string;
  litres: string;
  rate: string;
};
export type CustomerPaymentRow = { id: string; shiftId: string | null; customerId: string; typeId: string; amount: string };
/** What the database worked out per shift (opening cash used, D46). */
export type ShiftMoneyRow = { shiftId: string; openingCash: string };
export type SalesData = {
  payments: ShiftPayment[];
  counts: NoteCount[];
  slips: CreditSale[];
  customerPayments: CustomerPaymentRow[];
  money: ShiftMoneyRow[];
};

export function useSalesData(dayId: string | undefined) {
  const payments = useWaiting("shiftPayment", dayId);
  const counts = useWaiting("noteCount", dayId);
  return useQuery({
    queryKey: ["salesData", dayId],
    enabled: Boolean(dayId),
    select: (data) => (payments.length || counts.length ? overlaySales(data, [...payments, ...counts]) : data),
    queryFn: async (): Promise<SalesData> => {
      const id = dayId as string;
      const [payments, counts, slips, cps, money] = await Promise.all([
        supabase.from("shift_payments").select("id, shift_id, payment_type_id, amount::text, coins::text").eq("day_id", id),
        supabase.from("cash_counts").select("id, shift_id, denomination_id, note_count").eq("day_id", id),
        supabase
          .from("credit_sales")
          .select("id, shift_id, customer_id, vehicle_no, slip_no, product, entry_by, rupees::text, litres::text, rate::text")
          .eq("day_id", id)
          .order("created_at"),
        supabase.from("customer_payments").select("id, shift_id, customer_id, payment_type_id, amount::text").eq("day_id", id).order("created_at"),
        supabase.from("v_shift_money").select("shift_id, opening_cash::text").eq("day_id", id),
      ]);
      for (const r of [payments, counts, slips, cps, money]) if (r.error) throw r.error;
      return {
        payments: payments.data!.map((p) => ({ id: p.id, shiftId: p.shift_id, typeId: p.payment_type_id, amount: p.amount, coins: p.coins })),
        counts: counts.data!.map((c) => ({ id: c.id, shiftId: c.shift_id, noteId: c.denomination_id, count: c.note_count })),
        slips: slips.data!.map((x) => ({
          id: x.id,
          shiftId: x.shift_id,
          customerId: x.customer_id,
          vehicleNo: x.vehicle_no,
          slipNo: x.slip_no,
          product: x.product,
          entryBy: x.entry_by,
          rupees: x.rupees,
          litres: x.litres,
          rate: x.rate,
        })),
        customerPayments: cps.data!.map((c) => ({ id: c.id, shiftId: c.shift_id, customerId: c.customer_id, typeId: c.payment_type_id, amount: c.amount })),
        money: money.data!.map((m) => ({ shiftId: m.shift_id, openingCash: m.opening_cash })),
      };
    },
  });
}

function useSalesSave<T>(dayId: string | undefined, key: string, fn: (input: T) => Promise<void>, extraKeys: unknown[][] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["save", key],
    mutationFn: fn,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["salesData", dayId] });
      for (const k of extraKeys) qc.invalidateQueries({ queryKey: k });
    },
  });
}

export type ShiftPaymentSave = { shiftId: string; typeId: string; amount?: string | null; coins?: string | null };
export type NoteCountSave = { shiftId: string; noteId: string; count: number; cashTypeId: string };

async function sendShiftPayment({ pumpId, dayId, ...input }: ShiftPaymentSave & { pumpId: string; dayId: string }) {
  await check(
    supabase.from("shift_payments").upsert(
      {
        pump_id: pumpId,
        day_id: dayId,
        shift_id: input.shiftId,
        payment_type_id: input.typeId,
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.coins !== undefined ? { coins: input.coins } : {}),
      },
      { onConflict: "shift_id,payment_type_id" },
    ),
  );
}

async function sendNoteCount({ pumpId, dayId, ...input }: NoteCountSave & { pumpId: string; dayId: string }) {
  await check(
    supabase
      .from("cash_counts")
      .upsert({ pump_id: pumpId, day_id: dayId, shift_id: input.shiftId, denomination_id: input.noteId, note_count: input.count }, { onConflict: "shift_id,denomination_id" }),
  );
  await check(
    supabase
      .from("shift_payments")
      .upsert(
        { pump_id: pumpId, day_id: dayId, shift_id: input.shiftId, payment_type_id: input.cashTypeId },
        { onConflict: "shift_id,payment_type_id", ignoreDuplicates: true },
      ),
  );
}

async function sendOpeningCash(input: { shiftId: string; value: string | null }) {
  await check(supabase.from("shifts").update({ opening_cash: input.value }).eq("id", input.shiftId));
}

registerOutboxRunner("shiftPayment", (i) => sendShiftPayment(i as ShiftPaymentSave & { pumpId: string; dayId: string }));
registerOutboxRunner("noteCount", (i) => sendNoteCount(i as NoteCountSave & { pumpId: string; dayId: string }));
registerOutboxRunner("openingCash", (i) => sendOpeningCash(i as { shiftId: string; value: string | null }));

/** One ₹ total for a way of payment in a shift (or the coins, for Cash). Keyed by shift + type. Waits in the outbox offline (D70). */
export function useSaveShiftPayment(pumpId: string, dayId: string | undefined) {
  const box = useOutbox();
  return useSalesSave(dayId, "shiftPayment", (input: ShiftPaymentSave) =>
    saveOrQueue(
      box,
      {
        kind: "shiftPayment",
        key: `shiftPayment:${input.shiftId}:${input.typeId}:${input.amount !== undefined ? "a" : ""}${input.coins !== undefined ? "c" : ""}`,
        dayId: dayId as string,
        input: { ...input, pumpId, dayId },
      },
      () => sendShiftPayment({ ...input, pumpId, dayId: dayId as string }),
    ),
  );
}

/** How many of one note were counted in a shift's drawer. Saving the count also marks the cash as counted. */
export function useSaveNoteCount(pumpId: string, dayId: string | undefined) {
  const box = useOutbox();
  return useSalesSave(dayId, "noteCount", (input: NoteCountSave) =>
    saveOrQueue(
      box,
      { kind: "noteCount", key: `noteCount:${input.shiftId}:${input.noteId}`, dayId: dayId as string, input: { ...input, pumpId, dayId } },
      () => sendNoteCount({ ...input, pumpId, dayId: dayId as string }),
    ),
  );
}

/** Cash already in the drawer at the start of a shift; null = use the previous shift's count (D46). */
export function useSetOpeningCash(dayId: string | undefined) {
  const box = useOutbox();
  return useSalesSave(
    dayId,
    "openingCash",
    (input: { shiftId: string; value: string | null }) =>
      saveOrQueue(box, { kind: "openingCash", key: `openingCash:${input.shiftId}`, dayId: dayId as string, input }, () => sendOpeningCash(input)),
    [["shiftData", dayId]],
  );
}

/**
 * "Done" for a shift's sales (PRD F6): every way of payment still empty becomes ₹0, the cash counts
 * as counted (₹0 coins if nothing was typed), and the shift is marked done. Safe to tap twice.
 */
export function useSalesDone(pumpId: string, dayId: string | undefined) {
  return useSalesSave(
    dayId,
    "salesDone",
    async (input: { shiftId: string; types: PaymentType[]; existing: ShiftPayment[] }) => {
      const missing = input.types.filter((t) => t.kind !== "CREDIT" && !input.existing.some((p) => p.shiftId === input.shiftId && p.typeId === t.id));
      const emptyOther = input.types.filter(
        (t) => t.kind === "OTHER" && input.existing.some((p) => p.shiftId === input.shiftId && p.typeId === t.id && p.amount === null),
      );
      const rows = [
        ...missing.map((t) => ({ pump_id: pumpId, day_id: dayId, shift_id: input.shiftId, payment_type_id: t.id, ...(t.kind === "CASH" ? { coins: 0 } : { amount: 0 }) })),
        ...emptyOther.map((t) => ({ pump_id: pumpId, day_id: dayId, shift_id: input.shiftId, payment_type_id: t.id, amount: 0 })),
      ];
      if (rows.length) await check(supabase.from("shift_payments").upsert(rows, { onConflict: "shift_id,payment_type_id" }));
      await check(supabase.from("shifts").update({ sales_done_at: new Date().toISOString() }).eq("id", input.shiftId));
    },
    [["shiftData", dayId]],
  );
}

/** Adds a new credit customer (D50) and gives back its id. */
export function useAddCustomer(pumpId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["save", "customer"],
    mutationFn: async (name: string): Promise<string> => {
      const { data, error } = await supabase.from("credit_customers").insert({ pump_id: pumpId, name: name.trim() }).select("id").single();
      if (error) throw new Error(friendlyError(error, "Couldn't add the company. Try again."), { cause: error });
      return data.id as string;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["salesSetup", pumpId] }),
  });
}

/** Adds or fixes a credit slip (id made on the phone). The database works out ₹ ↔ litres and checks H6, H7. */
export function useSaveSlip(pumpId: string, dayId: string | undefined) {
  return useSalesSave(
    dayId,
    "slip",
    (input: { id: string; shiftId: string; customerId: string; vehicleNo: string; slipNo: string; product: Product; entryBy: "RUPEES" | "LITRES"; value: string }) =>
      check(
        supabase.from("credit_sales").upsert(
          {
            id: input.id,
            pump_id: pumpId,
            day_id: dayId,
            shift_id: input.shiftId,
            customer_id: input.customerId,
            vehicle_no: input.vehicleNo,
            slip_no: input.slipNo.trim(),
            product: input.product,
            entry_by: input.entryBy,
            // The other one is worked out by the database; a placeholder satisfies the column.
            rupees: input.entryBy === "RUPEES" ? input.value : 1,
            litres: input.entryBy === "LITRES" ? input.value : 1,
            rate: 1,
          },
          { onConflict: "id" },
        ),
      ),
  );
}

export function useDeleteSlip(dayId: string | undefined) {
  return useSalesSave(dayId, "slipDelete", (id: string) => check(supabase.from("credit_sales").delete().eq("id", id)));
}

/** A customer paying old dues / an advance (D29, D47). shiftId null = bank transfer, outside every shift. */
export function useSaveCustomerPayment(pumpId: string, dayId: string | undefined) {
  return useSalesSave(dayId, "customerPayment", (input: { id: string; shiftId: string | null; customerId: string; typeId: string; amount: string }) =>
    check(
      supabase.from("customer_payments").upsert(
        { id: input.id, pump_id: pumpId, day_id: dayId, shift_id: input.shiftId, customer_id: input.customerId, payment_type_id: input.typeId, amount: input.amount },
        { onConflict: "id" },
      ),
    ),
  );
}

export function useDeleteCustomerPayment(dayId: string | undefined) {
  return useSalesSave(dayId, "customerPaymentDelete", (id: string) => check(supabase.from("customer_payments").delete().eq("id", id)));
}

/**
 * The owner changes an opening (meter repaired or replaced): saved and approved in one go, since
 * the owner is the one who approves (owner, 27 Sep: "why is it asking me to send to owner?").
 */
export function useOwnerSetOpening(pumpId: string, dayId: string | undefined) {
  return useShiftSave(dayId, "ownerOpening", async (input: { shiftId: string; nozzleId: string; opening: string }) => {
    await check(
      supabase
        .from("nozzle_readings")
        .upsert(
          { pump_id: pumpId, day_id: dayId, shift_id: input.shiftId, nozzle_id: input.nozzleId, opening: input.opening, opening_typed: true },
          { onConflict: "shift_id,nozzle_id" },
        ),
    );
    const { data, error } = await supabase
      .from("nozzle_readings")
      .select("id, meter_change_status")
      .eq("shift_id", input.shiftId)
      .eq("nozzle_id", input.nozzleId)
      .single();
    if (error) throw new Error(friendlyError(error, "Couldn't save. Try again."), { cause: error });
    if (data.meter_change_status === "PENDING") await check(supabase.rpc("approve_meter_change", { p_reading: data.id }));
  });
}

/** The owner sets the dealer margin on the price in force (D64). Row Level Security lets only the owner. */
export function useSetMargin(pumpId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["save", "margin"],
    mutationFn: ({ priceId, margin }: { priceId: string; margin: string }) =>
      check(supabase.from("fuel_prices").update({ margin_per_l: margin }).eq("id", priceId).select("id").single()),
    onSettled: () => qc.invalidateQueries({ queryKey: ["daySetup", pumpId] }),
  });
}


// ─── Expenses (slice 4e) ──────────────────────────────────────────────────
export type PaidFrom = "SHIFT_A" | "SHIFT_B" | "SHIFT_C" | "OWNER" | "BANK";
export type ExpenseRow = {
  id: string;
  typeId: string;
  description: string | null;
  amount: string;
  paidFrom: PaidFrom;
  customerId: string | null;
};

export function useExpenses(dayId: string | undefined) {
  return useQuery({
    queryKey: ["expenses", dayId],
    enabled: Boolean(dayId),
    queryFn: async (): Promise<ExpenseRow[]> => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, category_id, description, amount::text, paid_from, customer_id")
        .eq("day_id", dayId as string)
        .order("created_at");
      if (error) throw error;
      return data.map((e) => ({ id: e.id, typeId: e.category_id, description: e.description, amount: e.amount, paidFrom: e.paid_from, customerId: e.customer_id }));
    },
  });
}

function useExpenseSave<T>(pumpId: string, dayId: string | undefined, key: string, fn: (input: T) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["save", key],
    mutationFn: fn,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["expenses", dayId] });
      qc.invalidateQueries({ queryKey: ["day", pumpId] });
    },
  });
}

/** Adds or fixes an expense (id made on the phone, so a retry never makes two). */
export function useSaveExpense(pumpId: string, dayId: string | undefined) {
  return useExpenseSave(pumpId, dayId, "expense", async (input: ExpenseRow) => {
    await check(
      supabase.from("expenses").upsert(
        {
          id: input.id,
          pump_id: pumpId,
          day_id: dayId,
          category_id: input.typeId,
          description: input.description,
          amount: input.amount,
          paid_from: input.paidFrom,
          customer_id: input.customerId,
        },
        { onConflict: "id" },
      ),
    );
  });
}

export function useDeleteExpense(pumpId: string, dayId: string | undefined) {
  return useExpenseSave(pumpId, dayId, "expenseDelete", (id: string) => check(supabase.from("expenses").delete().eq("id", id)));
}

/** "No expenses today" / "No tanker came today": one answer on the day (H4 counts it as done). */
export function useSetDayAnswer(pumpId: string, dayId: string | undefined) {
  return useExpenseSave(pumpId, dayId, "dayAnswer", (input: { field: "no_expenses" | "no_tanker"; value: boolean }) =>
    check(
      supabase
        .from("business_days")
        .update({ [input.field]: input.value })
        .eq("id", dayId as string)
        .select("id")
        .single(),
    ),
  );
}

// ─── Submit (slice 4f) ────────────────────────────────────────────────────
/**
 * Submits the day through the database's submit_day(), which re-checks everything (locked,
 * yesterday first, H6, H4, H2, H8, H9) and refuses with one plain sentence. Safe to tap twice.
 */
export function useSubmitDay(pumpId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["submit"],
    mutationFn: async (dayId: string): Promise<{ isMatched: boolean }> => {
      const { data, error } = await supabase.rpc("submit_day", { p_day: dayId });
      if (error) throw new Error(friendlyError(error, "Couldn't submit. Check the internet and try again."), { cause: error });
      return { isMatched: Boolean((data as { is_matched?: boolean } | null)?.is_matched) };
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["day", pumpId] });
      qc.invalidateQueries({ queryKey: ["recentDays", pumpId] });
    },
  });
}

/** Adds a new expense type (D82: owner or manager, like companies) and gives back its id. */
export function useAddExpenseType(pumpId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["save", "expenseType"],
    mutationFn: async (name: string): Promise<string> => {
      const { data, error } = await supabase
        .from("expense_categories")
        .insert({ pump_id: pumpId, name: name.trim(), default_type: "VARIABLE", sort_order: 100 })
        .select("id")
        .single();
      if (error) throw new Error(friendlyError(error, "Couldn't add the type. Try again."), { cause: error });
      return data.id as string;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["daySetup", pumpId] }),
  });
}

/** Owner: switch a nozzle on or off (D100). Row Level Security lets only the owner. */
export function useSetNozzleInUse(pumpId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["save", "nozzleInUse"],
    mutationFn: ({ nozzleId, inUse }: { nozzleId: string; inUse: boolean }) =>
      check(supabase.from("nozzles").update({ in_use: inUse }).eq("id", nozzleId).select("id").single()),
    onSettled: () => qc.invalidateQueries({ queryKey: ["daySetup", pumpId] }),
  });
}
