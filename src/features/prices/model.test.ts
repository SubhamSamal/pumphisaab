import { describe, expect, it } from "vitest";
import { checkMargin, checkPrice, priceList, waitingForDay, waitingRequests, type PriceRequest } from "./model";

const req = (over: Partial<PriceRequest>): PriceRequest => ({
  id: "r",
  dayId: "d1",
  product: "HSD",
  perLitre: "102.10",
  startsOn: "2026-10-20",
  status: "WAITING",
  askedBy: "Manager X",
  createdAt: "2026-10-20T06:10:00Z",
  ...over,
});

describe("price requests (D119)", () => {
  it("finds the waiting request per fuel for a day, ignoring answered ones and other days", () => {
    const list = [
      req({ id: "a" }),
      req({ id: "b", product: "MS", status: "KEPT" }),
      req({ id: "c", dayId: "d2", product: "MS" }),
    ];
    expect(waitingForDay(list, "d1")).toEqual({ HSD: list[0] });
    expect(waitingForDay(list, "d2")).toEqual({ MS: list[2] });
  });

  it("lists every waiting request oldest first, for the owner", () => {
    const list = [req({ id: "late", createdAt: "2026-10-20T09:00:00Z" }), req({ id: "early", createdAt: "2026-10-19T07:00:00Z" }), req({ id: "done", status: "APPROVED" })];
    expect(waitingRequests(list).map((r) => r.id)).toEqual(["early", "late"]);
  });
});

describe("price list (Profile › Fuel prices)", () => {
  const rows = [
    { id: "hsd-sep", product: "HSD" as const, perLitre: "101.74", startsOn: "2026-09-15", margin: "2.60" },
    { id: "hsd-oct", product: "HSD" as const, perLitre: "102.01", startsOn: "2026-10-20", margin: "2.60" },
    { id: "hsd-nov", product: "HSD" as const, perLitre: "103.00", startsOn: "2026-11-01", margin: null },
    { id: "ms-sep", product: "MS" as const, perLitre: "110.07", startsOn: "2026-09-15", margin: null },
  ];

  it("shows diesel first, newest first, marking the price in force today (same rule as price_for)", () => {
    const list = priceList(rows, "2026-10-20");
    expect(list.map((g) => g.product)).toEqual(["HSD", "MS"]);
    expect(list[0].entries.map((e) => [e.id, e.when])).toEqual([
      ["hsd-nov", "next"],
      ["hsd-oct", "now"],
      ["hsd-sep", "before"],
    ]);
    expect(list[1].entries.map((e) => e.when)).toEqual(["now"]);
  });

  it("a price starting tomorrow isn't in force today", () => {
    expect(priceList(rows, "2026-10-19")[0].entries.find((e) => e.when === "now")?.id).toBe("hsd-sep");
  });
});

describe("typed prices", () => {
  it("accepts a price per litre with up to 2 decimals", () => {
    expect(checkPrice("110.07")).toEqual({ kind: "ok", value: "110.07" });
    expect(checkPrice("102.10")).toEqual({ kind: "ok", value: "102.1" });
    expect(checkPrice("")).toEqual({ kind: "empty" });
  });

  it("refuses 0, too many decimals, a negative price or a price over ₹999", () => {
    expect(checkPrice("0").kind).toBe("bad");
    expect(checkPrice("110.075").kind).toBe("bad");
    expect(checkPrice("-5").kind).toBe("bad");
    expect(checkPrice("1100.70")).toEqual({ kind: "bad", message: "That's too much for one litre. Check it." });
  });

  it("margin: empty is fine, up to 2 decimals, under ₹100", () => {
    expect(checkMargin("")).toEqual({ kind: "empty" });
    expect(checkMargin("2.60")).toEqual({ kind: "ok", value: "2.6" });
    expect(checkMargin("260").kind).toBe("bad");
  });
});
