import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { clearDraft, readDraft, writeDraft } from "@/lib/drafts";

/** Reads a form's draft once. `loaded` is false until the phone has answered. */
export function useDraftLoad<T>(key: string) {
  const [state, setState] = useState<{ key: string; loaded: boolean; draft: T | null }>({ key, loaded: false, draft: null });
  useEffect(() => {
    let live = true;
    readDraft<T>(AsyncStorage, key).then((draft) => live && setState({ key, loaded: true, draft }));
    return () => {
      live = false;
    };
  }, [key]);
  const forget = useCallback(() => {
    void clearDraft(AsyncStorage, key);
    setState({ key, loaded: true, draft: null });
  }, [key]);
  return { loaded: state.loaded && state.key === key, draft: state.key === key ? state.draft : null, forget };
}

/**
 * Keeps `data` on the phone on every change (in order, so an old write never lands last) while
 * it differs from `start`. Call `discard()` once the form is saved or removed.
 */
export function useKeepDraft<T>(key: string, data: T, start: T) {
  const queue = useRef<Promise<void>>(Promise.resolve());
  const stopped = useRef(false);
  const startJson = useRef(JSON.stringify(start));
  const json = JSON.stringify(data);

  useEffect(() => {
    if (stopped.current) return;
    const changed = json !== startJson.current;
    queue.current = queue.current.then(() =>
      stopped.current ? undefined : changed ? writeDraft(AsyncStorage, key, JSON.parse(json) as T) : clearDraft(AsyncStorage, key),
    );
  }, [key, json]);

  return useCallback(() => {
    stopped.current = true;
    queue.current = queue.current.then(() => clearDraft(AsyncStorage, key));
  }, [key]);
}
