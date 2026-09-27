import type { Customer } from "./queries";

/** "  Dord   logistics " and "Dord Logistics" are the same company. */
export const normName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** Companies that match what's typed (D68): names starting with it first, then names containing it. */
export function matchCustomers(customers: Customer[], typed: string, limit = 5) {
  const term = normName(typed);
  const active = customers.filter((c) => c.isActive);
  if (!term) return active.slice(0, limit);
  const starts = active.filter((c) => normName(c.name).startsWith(term));
  const has = active.filter((c) => !normName(c.name).startsWith(term) && normName(c.name).includes(term));
  return [...starts, ...has].slice(0, limit);
}
