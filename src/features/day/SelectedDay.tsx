/**
 * Which business day the manager or owner is working on. Today by default (from the server's
 * clock, D17); the date stepper on Today can move it back (D49). Later tabs (Sales, Tanker)
 * follow the same day.
 */

import { createContext, useContext, useState, type ReactNode } from "react";
import { currentBusinessDate } from "@/lib/businessDay";
import { useMembership } from "@/features/session/SessionProvider";
import { useBusinessDate } from "@/features/setup/queries";

const PickedDate = createContext<{ picked: string | null; setPicked: (d: string | null) => void } | null>(null);

export function SelectedDayProvider({ children }: { children: ReactNode }) {
  const [picked, setPicked] = useState<string | null>(null);
  return <PickedDate.Provider value={{ picked, setPicked }}>{children}</PickedDate.Provider>;
}

export function useSelectedDay() {
  const ctx = useContext(PickedDate);
  if (!ctx) throw new Error("useSelectedDay must be used inside SelectedDayProvider");
  const me = useMembership();
  const server = useBusinessDate(me.pump.id);
  // The phone's guess shows only while the server's answer loads; saving waits for the server.
  const today = server.data ?? currentBusinessDate(me.pump.dayStartTime);
  const date = ctx.picked && ctx.picked < today ? ctx.picked : today;
  return {
    today,
    serverKnown: Boolean(server.data),
    date,
    isToday: date === today,
    setDate: (d: string) => ctx.setPicked(d >= today ? null : d),
  };
}
