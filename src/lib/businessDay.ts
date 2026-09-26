/**
 * Business day, not calendar day (CLAUDE.md hard rule 9). Every date decision goes through here.
 *
 * A business day runs from the pump's day start (default 06:00) in Asia/Kolkata to the same time
 * next day, so Shift C entries made at 02:00 belong to the previous calendar date.
 * India has no daylight saving, so IST is a fixed UTC+05:30.
 */

const IST_OFFSET_MINUTES = 5 * 60 + 30;
export const DEFAULT_DAY_START = "06:00";

function parseHhMm(hhmm: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) throw new Error(`Expected HH:MM, got ${hhmm}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** The business date (YYYY-MM-DD) that the instant `at` belongs to. */
export function businessDateAt(at: Date, dayStart: string = DEFAULT_DAY_START): string {
  const ms = at.getTime();
  if (!Number.isFinite(ms)) throw new Error("Invalid date");
  const shifted = new Date(ms + (IST_OFFSET_MINUTES - parseHhMm(dayStart)) * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** Today's business date for the pump. */
export function currentBusinessDate(dayStart: string = DEFAULT_DAY_START, now: Date = new Date()): string {
  return businessDateAt(now, dayStart);
}

/** Previous / next business date, by calendar arithmetic on the YYYY-MM-DD string. */
export function addDays(isoDate: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) throw new Error(`Expected YYYY-MM-DD, got ${isoDate}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return d.toISOString().slice(0, 10);
}
