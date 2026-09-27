// The outbox (D70): a box saved with no internet waits on the phone and is sent by itself, in
// order, when the internet is back. Every save it holds is safe to repeat (keyed by what it is:
// a tank's dip, a nozzle's reading, a shift's Paytm total …), so sending twice never doubles.
// Pure logic here; src/features/day/Outbox.tsx runs it in the app.

import type { DraftStore } from "./drafts";

export type OutboxItem = {
  id: string;
  /** Which save: "tankReading", "nozzleReading", "shiftPayment", "noteCount", "openingCash". */
  kind: string;
  /** What it saves ("tankReading:<day>:<tank>:OPENING"): a newer save of the same thing replaces it. */
  key: string;
  dayId: string;
  input: unknown;
  at: number;
};

export type Dropped = { item: OutboxItem; message: string };

export const OUTBOX_KEY = "outbox:v1";

/** No internet (the same words friendlyError uses), as opposed to the database refusing a save. */
export function isNoInternet(error: unknown): boolean {
  const m = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return m.startsWith("no internet") || m.includes("network request failed") || m.includes("failed to fetch") || m.includes("fetch failed");
}

/** Adds a save; a waiting save of the same thing is replaced (only the latest value matters). */
export function enqueue(items: OutboxItem[], item: OutboxItem): OutboxItem[] {
  return [...items.filter((i) => i.key !== item.key), item];
}

export async function loadOutbox(store: DraftStore): Promise<OutboxItem[]> {
  try {
    const raw = await store.getItem(OUTBOX_KEY);
    const items = raw ? (JSON.parse(raw) as OutboxItem[]) : [];
    return Array.isArray(items) ? items.filter((i) => i && typeof i.kind === "string" && typeof i.key === "string") : [];
  } catch {
    return [];
  }
}

export async function saveOutbox(store: DraftStore, items: OutboxItem[]): Promise<void> {
  try {
    if (items.length) await store.setItem(OUTBOX_KEY, JSON.stringify(items));
    else await store.removeItem(OUTBOX_KEY);
  } catch {
    // A full phone storage must never stop typing; the save stays in memory.
  }
}

/**
 * Sends waiting saves oldest first. Stops at the first "no internet" (everything from there waits
 * for the next try). A save the database refuses (say the day got locked meanwhile) is dropped and
 * reported, so it can't block the others.
 */
export async function flushOutbox(
  items: OutboxItem[],
  run: (item: OutboxItem) => Promise<void>,
): Promise<{ left: OutboxItem[]; sent: OutboxItem[]; dropped: Dropped[] }> {
  const sent: OutboxItem[] = [];
  const dropped: Dropped[] = [];
  for (let i = 0; i < items.length; i++) {
    try {
      await run(items[i]);
      sent.push(items[i]);
    } catch (e) {
      if (isNoInternet(e)) return { left: items.slice(i), sent, dropped };
      dropped.push({ item: items[i], message: (e as Error)?.message || "Couldn't save." });
    }
  }
  return { left: [], sent, dropped };
}

/** A Save-button form (tanker, slip, expense) with no internet: its draft is kept on the phone (D67). */
export function formSaveError(message: string): string {
  return isNoInternet({ message }) ? "No internet. What you typed is kept on this phone; tap Save again when the internet is back." : message;
}
