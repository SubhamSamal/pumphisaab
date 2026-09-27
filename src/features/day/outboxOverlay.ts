/**
 * Saves waiting in the outbox (no internet, D70), laid over what was last loaded, so a box shows
 * what was typed even after leaving the screen and coming back. Pure functions (tested).
 * Types only from ./queries (no runtime import, so no import loop).
 */
import type { OutboxItem } from "@/lib/outbox";
import type { NoteCountSave, NozzleReadingSave, SalesData, ShiftData, ShiftPaymentSave, TankReading, TankReadingSave } from "./queries";

export function overlayReadings(readings: TankReading[], waiting: OutboxItem[]): TankReading[] {
  let out = [...readings];
  for (const w of waiting) {
    const i = w.input as TankReadingSave;
    const found = out.find((r) => r.tankId === i.tankId && r.type === i.type);
    const next: TankReading = {
      id: found?.id ?? `waiting-${w.id}`,
      tankId: i.tankId,
      type: i.type,
      dipCm: i.dipCm,
      bookStockLitres: i.type === "OPENING" ? i.bookStockLitres : null,
      version: found?.version ?? 0,
    };
    out = found ? out.map((r) => (r === found ? next : r)) : [...out, next];
  }
  return out;
}

export function overlayShiftData(data: ShiftData, waiting: OutboxItem[]): ShiftData {
  let { lines, shifts } = data;
  for (const w of waiting) {
    if (w.kind === "openingCash") {
      const i = w.input as { shiftId: string; value: string | null };
      shifts = shifts.map((s) => (s.id === i.shiftId ? { ...s, openingCash: i.value } : s));
      continue;
    }
    const i = w.input as NozzleReadingSave;
    lines = lines.map((l) => {
      if (l.shiftId !== i.shiftId || l.nozzleId !== i.nozzleId) return l;
      return {
        ...l,
        ...(i.closing !== undefined ? { closing: i.closing } : {}),
        ...(i.openingTyped !== undefined ? { openingTyped: i.openingTyped, opening: i.openingTyped ? (i.opening ?? null) : l.previousClosing } : {}),
      };
    });
  }
  return { ...data, lines, shifts };
}

export function overlaySales(data: SalesData, waiting: OutboxItem[]): SalesData {
  let { payments, counts } = data;
  for (const w of waiting) {
    if (w.kind === "noteCount") {
      const i = w.input as NoteCountSave;
      const found = counts.find((c) => c.shiftId === i.shiftId && c.noteId === i.noteId);
      counts = found
        ? counts.map((c) => (c === found ? { ...c, count: i.count } : c))
        : [...counts, { id: `waiting-${w.id}`, shiftId: i.shiftId, noteId: i.noteId, count: i.count }];
      if (!payments.some((p) => p.shiftId === i.shiftId && p.typeId === i.cashTypeId))
        payments = [...payments, { id: `waiting-cash-${w.id}`, shiftId: i.shiftId, typeId: i.cashTypeId, amount: null, coins: null }];
      continue;
    }
    const i = w.input as ShiftPaymentSave;
    const found = payments.find((p) => p.shiftId === i.shiftId && p.typeId === i.typeId);
    const patch = { ...(i.amount !== undefined ? { amount: i.amount } : {}), ...(i.coins !== undefined ? { coins: i.coins } : {}) };
    payments = found
      ? payments.map((p) => (p === found ? { ...p, ...patch } : p))
      : [...payments, { id: `waiting-${w.id}`, shiftId: i.shiftId, typeId: i.typeId, amount: null, coins: null, ...patch }];
  }
  return { ...data, payments, counts };
}
