import { describe, expect, it } from "vitest";
import type { DraftStore } from "./drafts";
import { enqueue, flushOutbox, isNoInternet, loadOutbox, OUTBOX_KEY, saveOutbox, type OutboxItem } from "./outbox";

const item = (key: string, at = 0, input: unknown = key): OutboxItem => ({ id: `${key}-${at}`, kind: "shiftPayment", key, dayId: "d", input, at });
const memory = () => {
  const m = new Map<string, string>();
  const store: DraftStore = {
    getItem: async (k) => m.get(k) ?? null,
    setItem: async (k, v) => void m.set(k, v),
    removeItem: async (k) => void m.delete(k),
  };
  return { m, store };
};

describe("outbox (D70)", () => {
  it("keeps only the latest save of the same box, in the order typed", () => {
    let q: OutboxItem[] = [];
    q = enqueue(q, item("paytm", 1, "100"));
    q = enqueue(q, item("card", 2));
    q = enqueue(q, item("paytm", 3, "150"));
    expect(q.map((i) => [i.key, i.input])).toEqual([
      ["card", "card"],
      ["paytm", "150"],
    ]);
  });

  it("tells no internet apart from the database refusing", () => {
    expect(isNoInternet(new Error("No internet. Check the connection and try again."))).toBe(true);
    expect(isNoInternet(new TypeError("Network request failed"))).toBe(true);
    expect(isNoInternet(new Error("This day is locked. Ask the owner to unlock it."))).toBe(false);
  });

  it("sends oldest first, stops at no internet, and drops a save the database refuses", async () => {
    const q = [item("a"), item("b"), item("c"), item("d")];
    const ran: string[] = [];
    const run = async (i: OutboxItem) => {
      ran.push(i.key);
      if (i.key === "b") throw new Error("This day is locked. Ask the owner to unlock it.");
      if (i.key === "c") throw new Error("No internet. Check the connection and try again.");
    };
    const r = await flushOutbox(q, run);
    expect(ran).toEqual(["a", "b", "c"]);
    expect(r.sent.map((i) => i.key)).toEqual(["a"]);
    expect(r.dropped.map((d) => [d.item.key, d.message])).toEqual([["b", "This day is locked. Ask the owner to unlock it."]]);
    expect(r.left.map((i) => i.key)).toEqual(["c", "d"]);
    expect((await flushOutbox(r.left, async () => {})).left).toEqual([]);
  });

  it("survives the app closing (kept on the phone), and a broken copy is ignored", async () => {
    const { m, store } = memory();
    await saveOutbox(store, [item("a")]);
    expect((await loadOutbox(store)).map((i) => i.key)).toEqual(["a"]);
    await saveOutbox(store, []);
    expect(m.has(OUTBOX_KEY)).toBe(false);
    m.set(OUTBOX_KEY, "{broken");
    expect(await loadOutbox(store)).toEqual([]);
  });
});

it("tells a Save form with no internet that its typing is kept", async () => {
  const { formSaveError } = await import("./outbox");
  expect(formSaveError("No internet. Check the connection and try again.")).toMatch(/kept on this phone/);
  expect(formSaveError("Slip 4461 is already saved for SVT.")).toBe("Slip 4461 is already saved for SVT.");
});
