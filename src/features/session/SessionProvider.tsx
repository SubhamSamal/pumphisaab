/**
 * Who is signed in, which pump they belong to, and their role.
 *
 * status:
 *   starting      reading the saved session
 *   signedOut     show the sign-in screen
 *   loading       signed in, fetching the pump membership
 *   noPump        signed in, but the login isn't linked to a pump (or was switched off)
 *   error         couldn't load (usually no internet); offer "Try again"
 *   notConfigured .env doesn't have the Supabase values yet (developer setup)
 *   ready         everything known; show the app
 */

import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import { friendlyError } from "@/lib/errors";
import { isSupabaseConfigured, loadKeepSignedIn, setKeepSignedIn, supabase } from "@/lib/supabase";
import { loginEmail, normaliseUsername } from "@/lib/username";

export type Role = "owner" | "manager";

export type Membership = {
  memberId: string;
  username: string;
  fullName: string;
  role: Role;
  pump: { id: string; name: string; dayStartTime: string };
};

export type SessionStatus = "starting" | "signedOut" | "loading" | "noPump" | "error" | "notConfigured" | "ready";

type SessionValue = {
  status: SessionStatus;
  session: Session | null;
  membership: Membership | null;
  /** Convenience: the signed-in person's role (manager until known). */
  role: Role;
  errorMessage: string | null;
  signIn: (username: string, password: string, keep: boolean) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  retry: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

async function fetchMembership(userId: string): Promise<Membership | null> {
  const { data, error } = await supabase
    .from("pump_members")
    .select("id, username, full_name, role, pump:pumps(id, name, day_start_time)")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.pump) return null;
  const pump = data.pump as unknown as { id: string; name: string; day_start_time: string };
  return {
    memberId: data.id,
    username: data.username,
    fullName: data.full_name,
    role: data.role === "OWNER" ? "owner" : "manager",
    pump: { id: pump.id, name: pump.name, dayStartTime: pump.day_start_time.slice(0, 5) },
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [started, setStarted] = useState(false);

  // Read the saved session once, then follow sign-in / sign-out / token refresh.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    loadKeepSignedIn()
      .then(() => supabase.auth.getSession())
      .then(({ data }) => {
        if (!alive) return;
        setSession(data.session);
        setStarted(true);
      })
      .catch(() => alive && setStarted(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // On phones, refresh the sign-in token only while the app is open (Supabase guidance).
  useEffect(() => {
    if (!isSupabaseConfigured || Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => sub.remove();
  }, []);

  const userId = session?.user.id ?? null;
  const membershipQuery = useQuery({
    queryKey: ["membership", userId],
    queryFn: () => fetchMembership(userId as string),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });

  const value = useMemo<SessionValue>(() => {
    let status: SessionStatus;
    if (!isSupabaseConfigured) status = "notConfigured";
    else if (!started) status = "starting";
    else if (!session) status = "signedOut";
    else if (membershipQuery.isPending) status = "loading";
    else if (membershipQuery.isError) status = "error";
    else if (!membershipQuery.data) status = "noPump";
    else status = "ready";

    return {
      status,
      session,
      membership: membershipQuery.data ?? null,
      role: membershipQuery.data?.role ?? "manager",
      errorMessage: membershipQuery.isError ? friendlyError(membershipQuery.error, "Couldn't load your pump. Try again.") : null,
      signIn: async (username, password, keep) => {
        setKeepSignedIn(keep);
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail(normaliseUsername(username)), password });
        return { error: error ? friendlyError(error) : null };
      },
      signOut: async () => {
        await supabase.auth.signOut();
        queryClient.clear();
      },
      retry: () => {
        membershipQuery.refetch();
      },
    };
  }, [started, session, membershipQuery, queryClient]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

/** The signed-in person's membership. Only for screens behind the "ready" guard. */
export function useMembership(): Membership {
  const { membership } = useSession();
  if (!membership) throw new Error("useMembership used before the session was ready");
  return membership;
}
