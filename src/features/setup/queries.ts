/**
 * Reading and changing the pump's logins and staff. Every change goes through Supabase with
 * Row Level Security, so the database decides who may do what; the screens only follow.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { friendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

// ─── Business date (from the server's clock, decision D17) ─────────────────
export function useBusinessDate(pumpId: string) {
  return useQuery({
    queryKey: ["businessDate", pumpId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("current_business_date", { p_pump: pumpId });
      if (error) throw error;
      return data as string; // YYYY-MM-DD
    },
    refetchInterval: 5 * 60 * 1000,
  });
}

// ─── Logins ───────────────────────────────────────────────────────────────
export type Member = { id: string; username: string; fullName: string; role: "OWNER" | "MANAGER"; isActive: boolean };

export function useMembers(pumpId: string) {
  return useQuery({
    queryKey: ["members", pumpId],
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from("pump_members")
        .select("id, username, full_name, role, is_active")
        .eq("pump_id", pumpId)
        .order("role", { ascending: false }) // OWNER first
        .order("full_name");
      if (error) throw error;
      return data.map((m) => ({ id: m.id, username: m.username, fullName: m.full_name, role: m.role, isActive: m.is_active }));
    },
  });
}

/** Calls the create-user function (the only way logins are made or changed). */
async function callCreateUser(body: Record<string, unknown>): Promise<void> {
  const { data, error } = await supabase.functions.invoke("create-user", { body });
  if (error) {
    // The function replies with { ok: false, message } for problems the owner can fix.
    const reply = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(reply?.message ?? friendlyError(error, "Couldn't reach the server. Try again."));
  }
  if (data && data.ok === false) throw new Error(data.message);
}

function useLoginAction<T extends Record<string, unknown>>(pumpId: string, action: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: T) => callCreateUser({ action, pumpId, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", pumpId] }),
  });
}

export const useCreateManager = (pumpId: string) =>
  useLoginAction<{ username: string; fullName: string; password: string }>(pumpId, "create");
export const useResetPassword = (pumpId: string) => useLoginAction<{ memberId: string; password: string }>(pumpId, "resetPassword");
export const useSetLoginActive = (pumpId: string) => useLoginAction<{ memberId: string; active: boolean }>(pumpId, "setActive");

// ─── Staff ────────────────────────────────────────────────────────────────
export type StaffMember = { id: string; name: string; isActive: boolean; version: number };

export function useStaff(pumpId: string) {
  return useQuery({
    queryKey: ["staff", pumpId],
    queryFn: async (): Promise<StaffMember[]> => {
      const { data, error } = await supabase.from("staff").select("id, name, is_active, version").eq("pump_id", pumpId).order("name");
      if (error) throw error;
      return data.map((s) => ({ id: s.id, name: s.name, isActive: s.is_active, version: s.version }));
    },
  });
}

export function useAddStaff(pumpId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("staff").insert({ pump_id: pumpId, name: name.trim() });
      if (error) throw new Error(friendlyError(error));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff", pumpId] }),
  });
}

/** Rename or switch on/off. Sends the version it read, so two people can't overwrite each other. */
export function useUpdateStaff(pumpId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ member, changes }: { member: StaffMember; changes: { name?: string; is_active?: boolean } }) => {
      const { error } = await supabase
        .from("staff")
        .update({ ...changes, version: member.version })
        .eq("id", member.id);
      if (error) throw new Error(friendlyError(error));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["staff", pumpId] }),
  });
}
