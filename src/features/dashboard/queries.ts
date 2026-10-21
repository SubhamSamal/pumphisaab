/**
 * Dashboard reads (owner only). The fuel trend reads the database's v_day_match, the same view
 * Review and submit_day() use (hard rule 4). Numbers are read as text (hard rule 3).
 */

import { useQuery } from "@tanstack/react-query";
import type { Product } from "@/calc";
import { supabase } from "@/lib/supabase";
import { buildTrend, groupNozzleChecks, trendFrom, type NozzleCheckGroup, type Trend, type TrendDay, type TrendMatch } from "./trend";

export function useFuelTrend(pumpId: string, today: string | undefined) {
  return useQuery({
    queryKey: ["fuelTrend", pumpId, today],
    enabled: Boolean(today),
    queryFn: async (): Promise<Trend> => {
      const days = await supabase
        .from("business_days")
        .select("id, business_date, status, ms_price::text, hsd_price::text")
        .eq("pump_id", pumpId)
        .gte("business_date", trendFrom(today as string))
        .lte("business_date", today as string);
      if (days.error) throw days.error;
      type DayRow = { id: string; business_date: string; status: TrendDay["status"]; ms_price: string | null; hsd_price: string | null };
      const dayRows = days.data as unknown as DayRow[];
      const ids = dayRows.map((d) => d.id);
      let matchRows: { day_id: string; product: Product; sold_as_per_tank: string | null; sold_as_per_meters: string; difference: string | null; within_limit: boolean | null }[] = [];
      if (ids.length > 0) {
        const match = await supabase
          .from("v_day_match")
          .select("day_id, product, sold_as_per_tank::text, sold_as_per_meters::text, difference::text, within_limit")
          .in("day_id", ids);
        if (match.error) throw match.error;
        matchRows = match.data as unknown as typeof matchRows;
      }
      const trendDays: TrendDay[] = dayRows.map((d) => ({
        id: d.id,
        date: d.business_date,
        status: d.status,
        price: { ...(d.ms_price ? { MS: d.ms_price } : {}), ...(d.hsd_price ? { HSD: d.hsd_price } : {}) },
      }));
      const matches: TrendMatch[] = matchRows.map((m) => ({
        dayId: m.day_id,
        product: m.product,
        soldAsPerTank: m.sold_as_per_tank,
        soldAsPerMeters: m.sold_as_per_meters,
        difference: m.difference,
        withinLimit: m.within_limit,
      }));
      return buildTrend(trendDays, matches, today as string);
    },
  });
}

/** The last 30 days' 5 L measure checks (v_nozzle_checks, same maths as the app's S10), with who was on the nozzle. */
export function useNozzleChecks(pumpId: string, today: string | undefined) {
  return useQuery({
    queryKey: ["nozzleChecks", pumpId, today],
    enabled: Boolean(today),
    queryFn: async (): Promise<NozzleCheckGroup[]> => {
      const checks = await supabase
        .from("v_nozzle_checks")
        .select("business_date, shift_code, shift_id, nozzle_id, nozzle_label, product, meter_l::text, measured_l::text, error_l::text, error_pct::text, s10_flag")
        .eq("pump_id", pumpId)
        .gte("business_date", trendFrom(today as string))
        .lte("business_date", today as string);
      // Database update 17 not pasted yet: nothing to show.
      if (checks.error) {
        if (["42P01", "PGRST205", "PGRST204"].includes((checks.error as { code?: string }).code ?? "")) return [];
        throw checks.error;
      }
      type Row = {
        business_date: string;
        shift_code: string;
        shift_id: string;
        nozzle_id: string;
        nozzle_label: string;
        product: Product;
        meter_l: string;
        measured_l: string;
        error_l: string;
        error_pct: string;
        s10_flag: boolean;
      };
      const rows = checks.data as unknown as Row[];
      const shiftIds = [...new Set(rows.map((r) => r.shift_id))];
      const people = shiftIds.length
        ? await supabase.from("nozzle_attendants").select("shift_id, nozzle_id, staff:staff_id(name)").in("shift_id", shiftIds)
        : { data: [], error: null };
      const who = (r: Row) => {
        const p = (people.data as unknown as { shift_id: string; nozzle_id: string; staff: { name: string } | null }[] | null)?.find(
          (x) => x.shift_id === r.shift_id && x.nozzle_id === r.nozzle_id,
        );
        return p?.staff?.name ?? null;
      };
      return groupNozzleChecks(
        rows.map((r) => ({
          date: r.business_date,
          shift: r.shift_code,
          nozzleId: r.nozzle_id,
          label: r.nozzle_label,
          product: r.product,
          meterLitres: r.meter_l,
          measuredLitres: r.measured_l,
          error: r.error_l,
          errorPercent: r.error_pct,
          flagged: r.s10_flag,
          who: who(r),
        })),
      );
    },
  });
}
