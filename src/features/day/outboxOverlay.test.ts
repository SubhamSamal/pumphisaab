import { describe, expect, it } from "vitest";
import type { OutboxItem } from "@/lib/outbox";
import { overlayReadings, overlaySales, overlayShiftData } from "./outboxOverlay";
import type { SalesData, ShiftData } from "./queries";

const w = (kind: string, input: unknown, id = kind): OutboxItem => ({ id, kind, key: id, dayId: "d", input, at: 0 });

describe("waiting saves shown on top of loaded data (D70)", () => {
  it("dips: replaces the saved one, or adds a new one", () => {
    const saved = [{ id: "r1", tankId: "hsd", type: "OPENING" as const, dipCm: "120.0", bookStockLitres: null, version: 3 }];
    const out = overlayReadings(saved, [
      w("tankReading", { tankId: "hsd", type: "OPENING", dipCm: "121.5", bookStockLitres: "14000" }, "a"),
      w("tankReading", { tankId: "hsd", type: "CLOSING", dipCm: "99.9", bookStockLitres: "1" }, "b"),
    ]);
    expect(out).toEqual([
      { id: "r1", tankId: "hsd", type: "OPENING", dipCm: "121.5", bookStockLitres: "14000", version: 3 },
      { id: "waiting-b", tankId: "hsd", type: "CLOSING", dipCm: "99.9", bookStockLitres: null, version: 0 },
    ]);
  });

  it("meters and drawer cash", () => {
    const line = { shiftId: "A", nozzleId: "n", readingId: null, version: null, opening: null, openingTyped: false, closing: null, meterChange: "NONE" as const, hasPrevious: true, previousClosing: "100" };
    const data: ShiftData = {
      shifts: [{ id: "A", code: "A", startsAt: "", endsAt: "", openingCash: null, salesDoneAt: null }],
      lines: [line],
      attendants: [],
      tests: [],
    };
    const out = overlayShiftData(data, [
      w("nozzleReading", { shiftId: "A", nozzleId: "n", closing: "150" }, "a"),
      w("openingCash", { shiftId: "A", value: "500" }, "b"),
    ]);
    expect(out.lines[0].closing).toBe("150");
    expect(out.shifts[0].openingCash).toBe("500");
    const typed = overlayShiftData(data, [w("nozzleReading", { shiftId: "A", nozzleId: "n", openingTyped: true, opening: "90" })]);
    expect([typed.lines[0].opening, typed.lines[0].openingTyped]).toEqual(["90", true]);
  });

  it("payments and note counts (a note count also marks the cash as counted)", () => {
    const data: SalesData = { payments: [{ id: "p", shiftId: "A", typeId: "paytm", amount: "100", coins: null }], counts: [], slips: [], customerPayments: [], money: [] };
    const out = overlaySales(data, [
      w("shiftPayment", { shiftId: "A", typeId: "paytm", amount: "250" }, "a"),
      w("noteCount", { shiftId: "A", noteId: "n500", count: 7, cashTypeId: "cash" }, "b"),
    ]);
    expect(out.payments.map((p) => [p.typeId, p.amount])).toEqual([
      ["paytm", "250"],
      ["cash", null],
    ]);
    expect(out.counts).toEqual([{ id: "waiting-b", shiftId: "A", noteId: "n500", count: 7 }]);
  });
});
