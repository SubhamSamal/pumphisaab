import { expect, it } from "vitest";
import { clearDraft, DRAFT_MAX_AGE_MS, draftKey, readDraft, writeDraft, type DraftStore } from "./drafts";

const fakeStore = () => {
  const m = new Map<string, string>();
  const store: DraftStore = {
    getItem: async (k) => m.get(k) ?? null,
    setItem: async (k, v) => void m.set(k, v),
    removeItem: async (k) => void m.delete(k),
  };
  return { m, store };
};

it("keeps what was typed until it's cleared", async () => {
  const { store } = fakeStore();
  const key = draftKey("tanker", "pump", "day", "new");
  expect(key).toBe("draft:tanker:pump:day:new");
  expect(await readDraft(store, key)).toBeNull();
  await writeDraft(store, key, { vehicle: "OD02CD9087", chambers: [{ litres: "4000" }] });
  expect(await readDraft(store, key)).toEqual({ vehicle: "OD02CD9087", chambers: [{ litres: "4000" }] });
  await clearDraft(store, key);
  expect(await readDraft(store, key)).toBeNull();
});

it("drops an old or broken draft instead of failing", async () => {
  const { m, store } = fakeStore();
  await writeDraft(store, "old", { a: 1 }, 0);
  expect(await readDraft(store, "old", DRAFT_MAX_AGE_MS + 1)).toBeNull();
  expect(m.has("old")).toBe(false);
  m.set("bad", "{not json");
  expect(await readDraft(store, "bad")).toBeNull();
});

it("never throws when the phone's storage fails", async () => {
  const broken: DraftStore = {
    getItem: async () => Promise.reject(new Error("x")),
    setItem: async () => Promise.reject(new Error("x")),
    removeItem: async () => Promise.reject(new Error("x")),
  };
  await expect(writeDraft(broken, "k", 1)).resolves.toBeUndefined();
  await expect(readDraft(broken, "k")).resolves.toBeNull();
  await expect(clearDraft(broken, "k")).resolves.toBeUndefined();
});
