import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { enqueue, flushOutbox, isNoInternet, loadOutbox, saveOutbox, type Dropped, type OutboxItem } from "@/lib/outbox";
import { newId } from "@/lib/uuid";

/**
 * The outbox in the app (D70). Box saves that hit "no internet" wait here (and on the phone, so
 * closing the app loses nothing) and are sent in order: every 20 seconds, when the app comes back
 * to the front, and when the app starts. Screens show waiting values on top of the loaded ones.
 */

type Runner = (input: unknown) => Promise<void>;
const runners = new Map<string, Runner>();

/** queries.ts registers how to send each kind of save. */
export function registerOutboxRunner(kind: string, run: Runner) {
  runners.set(kind, run);
}

type OutboxContext = {
  items: OutboxItem[];
  dropped: Dropped[];
  add: (item: Omit<OutboxItem, "id" | "at">) => void;
  dismissDropped: () => void;
  flush: () => void;
};
const Ctx = createContext<OutboxContext | null>(null);

const RETRY_MS = 20_000;

export function OutboxProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [dropped, setDropped] = useState<Dropped[]>([]);
  const current = useRef<OutboxItem[]>([]);
  const busy = useRef(false);

  const update = useCallback((next: OutboxItem[]) => {
    current.current = next;
    setItems(next);
    void saveOutbox(AsyncStorage, next);
  }, []);

  const flush = useCallback(async () => {
    if (busy.current || current.current.length === 0) return;
    busy.current = true;
    try {
      const run = (item: OutboxItem) => {
        const r = runners.get(item.kind);
        return r ? r(item.input) : Promise.resolve();
      };
      const result = await flushOutbox(current.current, run);
      const done = new Set([...result.sent, ...result.dropped.map((d) => d.item)].map((i) => i.id));
      // Saves added while sending stay in the queue.
      update(current.current.filter((i) => !done.has(i.id)));
      if (result.dropped.length) setDropped((d) => [...d, ...result.dropped]);
      if (result.sent.length || result.dropped.length) await qc.invalidateQueries();
      // Internet is back and more saves arrived while sending: send them now.
      if (result.left.length === 0 && current.current.length > 0) setTimeout(() => void flushRef.current(), 0);
    } finally {
      busy.current = false;
    }
  }, [qc, update]);
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // Start: what was waiting when the app closed, then try to send it.
  useEffect(() => {
    let live = true;
    loadOutbox(AsyncStorage).then((saved) => {
      if (!live || saved.length === 0) return;
      current.current = [...saved, ...current.current.filter((i) => !saved.some((s) => s.id === i.id))];
      setItems(current.current);
      void flush();
    });
    return () => {
      live = false;
    };
  }, [flush]);

  // Retry while anything waits, and whenever the app comes back to the front.
  useEffect(() => {
    if (items.length === 0) return;
    const timer = setInterval(() => void flush(), RETRY_MS);
    const sub = AppState.addEventListener("change", (s) => s === "active" && void flush());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [items.length, flush]);

  const value = useMemo<OutboxContext>(
    () => ({
      items,
      dropped,
      add: (item) => update(enqueue(current.current, { ...item, id: newId(), at: Date.now() })),
      dismissDropped: () => setDropped([]),
      flush: () => void flush(),
    }),
    [items, dropped, update, flush],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useOutbox = () => useContext(Ctx);

/** Waiting saves of one kind for one day (screens lay them over the loaded data). */
export function useWaiting(kind: string, dayId: string | undefined): OutboxItem[] {
  const box = useContext(Ctx);
  return useMemo(() => (box && dayId ? box.items.filter((i) => i.kind === kind && i.dayId === dayId) : []), [box, kind, dayId]);
}

/**
 * Runs a box save now; with no internet it goes to the outbox instead of failing (resolves as
 * "kept on the phone"). The database refusing a save still fails as before. `queued.input` is what
 * the outbox will send later with its registered runner.
 */
export async function saveOrQueue(
  box: OutboxContext | null,
  queued: { kind: string; key: string; dayId: string; input: unknown },
  sendNow: () => Promise<void>,
): Promise<void> {
  // Saves already waiting go first: queue behind them so an older value can't land last.
  if (box && box.items.length > 0) {
    box.add(queued);
    box.flush();
    return;
  }
  try {
    await sendNow();
  } catch (e) {
    if (box && isNoInternet(e)) {
      box.add(queued);
      return;
    }
    throw e;
  }
}
