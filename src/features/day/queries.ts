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

// ─── Setup the day needs (tanks, charts, prices, rules) ───────────────────
export type SetupTank = { id: string; label: string; product: Product; chartId: string; isActive: boolean };
export type SetupNozzle = { id: string; label: string; product: Product; tankId: string; inUse: boolean };
export type DaySetup = {
  tanks: SetupTank[];
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
      const [pump, tanks, prices, nozzles] = await Promise.all([
        supabase.from("pumps").select("rules, first_business_date").eq("id", pumpId).single(),
        supabase.from("tanks").select("id, label, product, chart_id, is_active").eq("pump_id", pumpId).order("product").order("label"),
        supabase.from("fuel_prices").select("product, per_litre::text, starts_on").eq("pump_id", pumpId),
        supabase.from("nozzles").select("id, label, product, tank_id, in_use").eq("pump_id", pumpId).order("sort_order").order("label"),
      ]);
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
        // Same shape as src/calc/rules.ts (the seed test keeps them in step); defaults fill any gap.
        rules: { ...DEFAULT_RULES, ...(pump.data.rules as Partial<Rules>) },
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
  version: number;
};

const DAY_COLUMNS =
  "id, business_date, status, is_locked, owner_opened, ms_price::text, hsd_price::text, ms_price_now::text, hsd_price_now::text, price_confirmed, no_tanker, no_expenses, version";

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
  return useQuery({
    queryKey: ["tankReadings", dayId],
    enabled: Boolean(dayId),
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
export function useSaveTankReading(pumpId: string, dayId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["save", "tankReading"],
    mutationFn: async (input: { tankId: string; type: ReadingType; dipCm: string | null; bookStockLitres: string | null; version?: number }) => {
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
    },
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
export type Shift = { id: string; code: string; startsAt: string; endsAt: string };
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
  return useQuery({
    queryKey: ["shiftData", dayId],
    enabled: Boolean(dayId),
    queryFn: async (): Promise<ShiftData> => {
      const id = dayId as string;
      const [shifts, lines, attendants, tests] = await Promise.all([
        supabase.from("shifts").select("id, shift_code, starts_at, ends_at").eq("day_id", id).order("starts_at"),
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
        shifts: shifts.data!.map((s) => ({ id: s.id, code: s.shift_code, startsAt: s.starts_at, endsAt: s.ends_at })),
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

/**
 * Saves a closing reading, or a typed opening (meter change / first reading). The database copies
 * the opening from the previous closing unless `openingTyped`. Keyed by shift + nozzle (safe to repeat).
 */
export function useSaveNozzleReading(pumpId: string, dayId: string | undefined) {
  return useShiftSave(
    dayId,
    "nozzleReading",
    (input: { shiftId: string; nozzleId: string; closing?: string | null; opening?: string | null; openingTyped?: boolean; version?: number | null }) =>
      check(
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
};
export type Receipt = {
  id: string;
  dayId: string;
  businessDate: string;
  vehicleNo: string;
  invoiceNo: string | null;
  invoiceDate: string | null;
  lines: ReceiptLine[];
};

const RECEIPT_COLUMNS =
  "id, day_id, vehicle_no, invoice_no, invoice_date, created_at, day:business_days(business_date), lines:receipt_lines(id, product, tank_id, ordered_l::text, short_l::text, price_per_l::text, margin_per_l::text, dip_before_cm::text, dip_after_cm::text)";

type ReceiptRow = {
  id: string;
  day_id: string;
  vehicle_no: string;
  invoice_no: string | null;
  invoice_date: string | null;
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
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["tankers", dayId] });
      qc.invalidateQueries({ queryKey: ["recentTankers", pumpId] });
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

/** "No tanker today" on the day (completes the Tanker section when nothing came). */
export function useSetNoTanker(pumpId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["save", "noTanker"],
    mutationFn: ({ dayId, value }: { dayId: string; value: boolean }) =>
      check(supabase.from("business_days").update({ no_tanker: value }).eq("id", dayId)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["day", pumpId] }),
  });
}
