import type { IconName } from "@/components/ui";
import type { Role } from "@/features/session/RoleProvider";

export type TabKey = "index" | "sales" | "tanker" | "dashboard" | "profile";

/** Manager: Today · Sales · Tanker · Profile. Owner adds Dashboard. Alerts live behind the bell. */
export const TABS: { key: TabKey; label: string; icon: IconName; ownerOnly?: boolean }[] = [
  { key: "index", label: "Today", icon: "today" },
  { key: "sales", label: "Sales", icon: "rupee" },
  { key: "tanker", label: "Tanker", icon: "truck" },
  { key: "dashboard", label: "Dashboard", icon: "dashboard", ownerOnly: true },
  { key: "profile", label: "Profile", icon: "user" },
];

export function tabsFor(role: Role) {
  return TABS.filter((t) => !t.ownerOnly || role === "owner");
}
