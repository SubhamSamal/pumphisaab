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
export type DaySetup = {
  tanks: SetupTank[];
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
      const [pump, tanks, prices] = await Promise.all([
        supabase.from("pumps").select("rules, first_business_date").eq("id", pumpId).single(),
        supabase.from("tanks").select("id, label, product, chart_id, is_active").eq("pump_id", pumpId).order("product").order("label"),
        supabase.from("fuel_prices").select("product, per_litre::text, starts_on").eq("pump_id", pumpId),
      ]);
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
