import { describe, expect, it } from "vitest";
import { Decimal } from "./decimal";
import {
  fmtClock,
  fmtDate,
  istDate,
  fmtDifference,
  fmtDip,
  fmtLitres,
  fmtMeter,
  fmtRupees,
  fmtVehicle,
  MINUS,
} from "./format";

describe("fmtRupees", () => {
  it("uses Indian grouping (design formatting rules)", () => {
    expect(fmtRupees("150490", "input")).toBe("₹1,50,490.00");
    expect(fmtRupees("150490")).toBe("₹1,50,490");
    expect(fmtRupees("1418800")).toBe("₹14,18,800");
    expect(fmtRupees("850000")).toBe("₹8,50,000");
    expect(fmtRupees("999")).toBe("₹999");
    expect(fmtRupees("0")).toBe("₹0");
    expect(fmtRupees("123456789.5", "input")).toBe("₹12,34,56,789.50");
  });

  it("rounds half-up only at display", () => {
    expect(fmtRupees("100.005", "input")).toBe("₹100.01");
    expect(fmtRupees("1249.5")).toBe("₹1,250");
    expect(fmtRupees("1249.49")).toBe("₹1,249");
  });

  it("uses a true minus for negatives", () => {
    expect(fmtRupees("-3646")).toBe(`${MINUS}₹3,646`);
    expect(fmtRupees("-3646")).not.toContain("-");
  });

  it("accepts Decimals and exact strings, never floats drifting", () => {
    expect(fmtRupees(new Decimal("0.1").plus("0.2"), "input")).toBe("₹0.30");
  });

  it("rejects junk", () => {
    expect(() => fmtRupees("abc")).toThrow();
    expect(() => fmtRupees("Infinity")).toThrow();
  });
});

describe("fmtLitres", () => {
  it("shows up to 2 decimals with a space and L", () => {
    expect(fmtLitres("48210.5")).toBe("48,210.50 L");
    expect(fmtLitres("13215.374")).toBe("13,215.37 L");
    expect(fmtLitres("21628.93")).toBe("21,628.93 L");
    expect(fmtLitres("8119")).toBe("8,119 L");
    expect(fmtLitres("8119.00")).toBe("8,119 L");
    expect(fmtLitres("0.004")).toBe("0 L");
    expect(fmtLitres("-42")).toBe(`${MINUS}42 L`);
  });
});

describe("fmtMeter", () => {
  it("always shows 2 decimals, no unit", () => {
    expect(fmtMeter("48210")).toBe("48,210.00");
    expect(fmtMeter("31455.5")).toBe("31,455.50");
  });
});

describe("fmtDip", () => {
  it("shows 1 decimal and cm", () => {
    expect(fmtDip("123.5")).toBe("123.5 cm");
    expect(fmtDip("128")).toBe("128.0 cm");
    expect(fmtDip("0")).toBe("0.0 cm");
  });
});

describe("fmtDate", () => {
  it("formats business dates as DD Mon YYYY", () => {
    expect(fmtDate("2026-10-01")).toBe("01 Oct 2026");
    expect(fmtDate("2026-10-01", "weekday")).toBe("Thu, 01 Oct 2026");
    expect(fmtDate("2026-09-27", "weekday")).toBe("Sun, 27 Sep 2026");
    expect(fmtDate("2026-10-01", "short")).toBe("01 Oct");
  });

  it("rejects impossible or badly written dates", () => {
    expect(() => fmtDate("2026-02-30")).toThrow();
    expect(() => fmtDate("01/10/2026")).toThrow();
  });
});

describe("fmtVehicle", () => {
  it("uppercases and removes spaces", () => {
    expect(fmtVehicle("od05 ab 1234")).toBe("OD05AB1234");
    expect(fmtVehicle("OD-02-CD-9087")).toBe("OD02CD9087");
  });
});

describe("fmtDifference (sign rule)", () => {
  it("money: negative is a loss with a true minus", () => {
    expect(fmtDifference("-1250", "rupees")).toEqual({ tone: "loss", word: "Short", text: `${MINUS}₹1,250` });
  });

  it("money: positive is excess with a plus", () => {
    expect(fmtDifference("300", "rupees")).toEqual({ tone: "excess", word: "Excess", text: "+₹300" });
  });

  it("zero is Matched", () => {
    expect(fmtDifference("0", "rupees")).toEqual({ tone: "matched", word: "Matched", text: "Matched" });
    expect(fmtDifference("0.00", "litres", "8000")).toEqual({ tone: "matched", word: "Matched", text: "Matched" });
  });

  it("a difference that rounds to zero shows Matched, never −₹0", () => {
    expect(fmtDifference("-0.4", "rupees").tone).toBe("matched");
    expect(fmtDifference("-0.004", "litres").tone).toBe("matched");
  });

  it("PRD acceptance 7: −42 L on 8,000 L sold as per tank shows −42 L (−0.53%)", () => {
    expect(fmtDifference("-42", "litres", "8000")).toEqual({
      tone: "loss",
      word: "Short",
      text: `${MINUS}42 L (${MINUS}0.53%)`,
    });
  });

  it("litres keep up to 2 decimals", () => {
    expect(fmtDifference("12.5", "litres").text).toBe("+12.50 L");
  });
});

describe("fmtClock and istDate (shift times in India)", () => {
  it("shows the Indian clock time of an instant", () => {
    expect(fmtClock("2026-10-01T00:30:00Z")).toBe("6 AM");
    expect(fmtClock("2026-10-01T08:30:00Z")).toBe("2 PM");
    expect(fmtClock("2026-10-01T16:30:00Z")).toBe("10 PM");
    expect(fmtClock("2026-10-01T18:30:00Z")).toBe("12 AM");
    expect(fmtClock("2026-10-01T06:30:00Z")).toBe("12 PM");
    expect(fmtClock("2026-10-01T17:00:00+05:30")).toBe("5 PM");
    expect(fmtClock("2026-10-01T22:30:00+05:30")).toBe("10:30 PM");
  });
  it("gives the Indian date, so Shift C ends on the next morning", () => {
    expect(istDate("2026-10-02T00:30:00Z")).toBe("2026-10-02");
    expect(istDate("2026-10-01T20:00:00Z")).toBe("2026-10-02");
    expect(istDate("2026-10-01T18:00:00Z")).toBe("2026-10-01");
  });
});
