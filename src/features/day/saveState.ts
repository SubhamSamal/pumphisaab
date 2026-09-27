import { useIsMutating, useMutationState } from "@tanstack/react-query";
import type { SaveState } from "@/components/ui";
import { useOutbox } from "./Outbox";

/**
 * Saved / Saving… / Offline for the header, from every save on the day (mutations keyed "save").
 * Offline = saves are waiting on the phone (D70), or the latest save failed for no internet.
 */
export function useSaveState(): { state: SaveState; waiting: number } {
  const box = useOutbox();
  const waiting = box?.items.length ?? 0;
  return { state: useSaveWord(waiting), waiting };
}

function useSaveWord(waiting: number): SaveState {
  const saving = useIsMutating({ mutationKey: ["save"] });
  const latest = useMutationState({
    filters: { mutationKey: ["save"] },
    select: (m) => ({ status: m.state.status, error: m.state.error as Error | null, at: m.state.submittedAt }),
  })
    .sort((a, b) => a.at - b.at)
    .at(-1);
  if (saving > 0) return "saving";
  if (waiting > 0) return "offline";
  if (latest?.status === "error" && latest.error?.message.startsWith("No internet")) return "offline";
  return "saved";
}
