/** Something picked by name from a growing list: a credit customer, an expense type. */
export type Named = { id: string; name: string; isActive?: boolean; uses?: number };

/** "  Dord   logistics " and "Dord Logistics" are the same name. */
export const normName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * What the drop-down shows (D68, owner 29 Sep):
 *   nothing typed → the 2 most used (never the whole list, it only grows);
 *   something typed → up to 5 matches, names starting with it first, then names containing it.
 */
export function matchNamed<T extends Named>(items: T[], typed: string, { limit = 5, byDefault = 2 } = {}): T[] {
  const term = normName(typed);
  const active = items.filter((c) => c.isActive !== false);
  if (!term) {
    return active
      .filter((c) => (c.uses ?? 0) > 0)
      .sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0) || a.name.localeCompare(b.name))
      .slice(0, byDefault);
  }
  const starts = active.filter((c) => normName(c.name).startsWith(term));
  const has = active.filter((c) => !normName(c.name).startsWith(term) && normName(c.name).includes(term));
  return [...starts, ...has].slice(0, limit);
}

/** How often each id appears (most used first in the drop-down). */
export function countUses(ids: (string | null)[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ids) if (id) out[id] = (out[id] ?? 0) + 1;
  return out;
}
