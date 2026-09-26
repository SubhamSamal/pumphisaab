import { describe, expect, it } from "vitest";
import { addDays, businessDateAt, currentBusinessDate } from "./businessDay";

// Helper: an IST wall-clock time as a real instant.
const ist = (isoLocal: string) => new Date(`${isoLocal}+05:30`);

describe("businessDateAt (06:00 IST day start)", () => {
  it("06:00 IST starts the new business day", () => {
    expect(businessDateAt(ist("2026-10-01T06:00:00"))).toBe("2026-10-01");
    expect(businessDateAt(ist("2026-10-01T05:59:59"))).toBe("2026-09-30");
  });

  it("PRD acceptance 19: Shift C entry at 02:00 belongs to the previous calendar date", () => {
    expect(businessDateAt(ist("2026-10-02T02:00:00"))).toBe("2026-10-01");
  });

  it("late evening stays on the same day", () => {
    expect(businessDateAt(ist("2026-10-01T23:59:00"))).toBe("2026-10-01");
  });

  it("works whatever the phone's own time zone is (instant-based)", () => {
    // 00:30 UTC on 1 Oct = 06:00 IST on 1 Oct.
    expect(businessDateAt(new Date("2026-10-01T00:30:00Z"))).toBe("2026-10-01");
    expect(businessDateAt(new Date("2026-10-01T00:29:00Z"))).toBe("2026-09-30");
  });

  it("respects a custom day start", () => {
    expect(businessDateAt(ist("2026-10-01T06:30:00"), "07:00")).toBe("2026-09-30");
    expect(businessDateAt(ist("2026-10-01T00:00:00"), "00:00")).toBe("2026-10-01");
  });

  it("crosses month and year ends", () => {
    expect(businessDateAt(ist("2027-01-01T03:00:00"))).toBe("2026-12-31");
  });

  it("rejects bad input", () => {
    expect(() => businessDateAt(ist("2026-10-01T06:00:00"), "6am")).toThrow();
    expect(() => businessDateAt(new Date("nope"))).toThrow();
  });

  it("currentBusinessDate uses the given clock", () => {
    expect(currentBusinessDate("06:00", ist("2026-10-02T05:00:00"))).toBe("2026-10-01");
  });
});

describe("addDays", () => {
  it("moves across month ends and leap days", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });
});
