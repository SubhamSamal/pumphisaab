// Drafts: what was typed on a form with a Save button (tanker, credit slip), kept on the phone
// until it's saved, so Back, a phone call or the app closing loses nothing (owner, 28 Sep).
// Boxes that save on their own (dips, meters, cash) don't need this.

/** The bit of AsyncStorage we use; a fake one in tests. */
export type DraftStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type Saved<T> = { v: 1; at: number; data: T };

/** A draft older than this is dropped (the day has long moved on). */
export const DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export const draftKey = (...parts: string[]) => `draft:${parts.join(":")}`;

export async function readDraft<T>(store: DraftStore, key: string, now = Date.now()): Promise<T | null> {
  try {
    const raw = await store.getItem(key);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved<T>;
    if (saved?.v !== 1 || typeof saved.at !== "number" || now - saved.at > DRAFT_MAX_AGE_MS) {
      await store.removeItem(key);
      return null;
    }
    return saved.data;
  } catch {
    return null;
  }
}

export async function writeDraft<T>(store: DraftStore, key: string, data: T, now = Date.now()): Promise<void> {
  try {
    await store.setItem(key, JSON.stringify({ v: 1, at: now, data } satisfies Saved<T>));
  } catch {
    // A full or broken phone storage must never stop typing.
  }
}

export async function clearDraft(store: DraftStore, key: string): Promise<void> {
  try {
    await store.removeItem(key);
  } catch {
    // Nothing to do.
  }
}
