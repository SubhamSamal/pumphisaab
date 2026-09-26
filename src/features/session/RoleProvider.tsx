import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Role = "owner" | "manager";

type RoleContextValue = {
  role: Role;
  /** Developer-only preview switch (decision D8). Real roles come from login in Phase 2. */
  setDevRole: (r: Role) => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("manager");
  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      setDevRole: (r) => {
        if (__DEV__) setRole(r);
      },
    }),
    [role],
  );
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
}
