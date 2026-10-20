/**
 * Fuel prices and "Price is different" requests (D119). The database decides who may do what:
 * only the owner adds a price directly or answers a request; managers ask through request_price().
 * Numbers are read as text so no rupee passes through floating point (hard rule 3).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Product } from "@/calc";
import { friendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import type { PriceListRow, PriceRequest, PriceRequestStatus } from "./model";

export function usePriceList(pumpId: string) {
  return useQuery({
    queryKey: ["priceList", pumpId],
    queryFn: async (): Promise<PriceListRow[]> => {
      const { data, error } = await supabase
        .from("fuel_prices")
        .select("id, product, per_litre::text, starts_on, margin_per_l::text")
        .eq("pump_id", pumpId);
      if (error) throw error;
      return (data as unknown as { id: string; product: Product; per_litre: string; starts_on: string; margin_per_l: string | null }[]).map((r) => ({
        id: r.id,
        product: r.product,
        perLitre: r.per_litre,
        startsOn: r.starts_on,
        margin: r.margin_per_l,
      }));
    },
  });
}

/** Waiting requests and the last few answered ones (newest first). */
export function usePriceRequests(pumpId: string) {
  return useQuery({
    queryKey: ["priceRequests", pumpId],
    queryFn: async (): Promise<PriceRequest[]> => {
      const [requests, members] = await Promise.all([
        supabase
          .from("price_requests")
          .select("id, day_id, product, per_litre::text, starts_on, status, created_by, created_at")
          .eq("pump_id", pumpId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("pump_members").select("user_id, full_name").eq("pump_id", pumpId),
      ]);
      if (requests.error) throw requests.error;
      const names = new Map((members.data ?? []).map((m) => [m.user_id as string, m.full_name as string]));
      type Row = { id: string; day_id: string; product: Product; per_litre: string; starts_on: string; status: PriceRequestStatus; created_by: string | null; created_at: string };
      return (requests.data as unknown as Row[]).map((r) => ({
        id: r.id,
        dayId: r.day_id,
        product: r.product,
        perLitre: r.per_litre,
        startsOn: r.starts_on,
        status: r.status,
        askedBy: r.created_by ? (names.get(r.created_by) ?? null) : null,
        createdAt: r.created_at,
      }));
    },
    refetchInterval: 60 * 1000,
  });
}

function useAfterPriceChange(pumpId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["priceRequests", pumpId] });
    qc.invalidateQueries({ queryKey: ["priceList", pumpId] });
    qc.invalidateQueries({ queryKey: ["daySetup", pumpId] });
    qc.invalidateQueries({ queryKey: ["day", pumpId] });
  };
}

/** "Price is different": one call per fuel that changed. From the owner, the price is added at once. */
export function useRequestPrice(pumpId: string) {
  const after = useAfterPriceChange(pumpId);
  return useMutation({
    mutationKey: ["save", "priceRequest"],
    mutationFn: async ({ dayId, prices }: { dayId: string; prices: { product: Product; perLitre: string }[] }) => {
      for (const p of prices) {
        const { error } = await supabase.rpc("request_price", { p_day: dayId, p_product: p.product, p_per_litre: p.perLitre });
        if (error) throw new Error(friendlyError(error, "Couldn't send the price. Try again."), { cause: error });
      }
    },
    onSettled: after,
  });
}

/** Owner: Approve (the price is added from its start date) or Keep old price. */
export function useAnswerPriceRequest(pumpId: string) {
  const after = useAfterPriceChange(pumpId);
  return useMutation({
    mutationKey: ["save", "priceAnswer"],
    mutationFn: async ({ requestId, approve }: { requestId: string; approve: boolean }) => {
      const { error } = await supabase.rpc("answer_price_request", { p_request: requestId, p_approve: approve });
      if (error) throw new Error(friendlyError(error, "Couldn't save your answer. Try again."), { cause: error });
    },
    onSettled: after,
  });
}

/** Owner: add a price with its start date and margin. Row Level Security lets only the owner. */
export function useAddPrice(pumpId: string) {
  const after = useAfterPriceChange(pumpId);
  return useMutation({
    mutationKey: ["save", "price"],
    mutationFn: async (input: { product: Product; perLitre: string; startsOn: string; margin: string | null }) => {
      const { error } = await supabase
        .from("fuel_prices")
        .insert({ pump_id: pumpId, product: input.product, per_litre: input.perLitre, starts_on: input.startsOn, margin_per_l: input.margin })
        .select("id")
        .single();
      if (error) {
        if ((error as { code?: string }).code === "23505") throw new Error("There's already a price for that fuel starting that day.", { cause: error });
        throw new Error(friendlyError(error, "Couldn't add the price. Try again."), { cause: error });
      }
    },
    onSettled: after,
  });
}
