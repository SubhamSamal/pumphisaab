/**
 * Dashboard reads (owner only). The fuel trend reads the database's v_day_match, the same view
 * Review and submit_day() use (hard rule 4). Numbers are read as text (hard rule 3).
 */

import { useQuery } from "@tanstack/react-query";
import type { Product } from "@/calc";
import { supabase } from "@/lib/supabase";
import { buildTrend, trendFrom, type Trend, type TrendDay, type TrendMatch } from "./trend";

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
