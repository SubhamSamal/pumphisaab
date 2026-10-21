import { useEffect, useRef, useState } from "react";

/** How long the green "Saved" tick stays beside a box (UI audit 1, item 6). */
const SHOW_MS = 1500;

/** Which boxes were just saved, so each can show a short "Saved" tick (owner, 03 Oct: people tapped again). */
export function useJustSaved() {
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  const mark = (key: string) => {
    setKeys((k) => new Set(k).add(key));
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(
      () =>
        setKeys((k) => {
          const n = new Set(k);
          n.delete(key);
          return n;
        }),
      SHOW_MS,
    );
  };
  return { mark, is: (key: string) => keys.has(key) };
}
