/**
 * A random id made on the phone for a new list row (a test, later slips and expenses), so that
 * sending the same save twice (a retry after a network drop) updates one row instead of making two.
 * Not used for anything secret.
 */
export function newId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
