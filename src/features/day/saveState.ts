import { useIsMutating, useMutationState } from "@tanstack/react-query";
import type { SaveState } from "@/components/ui";

/**
 * Saved / Saving… / Offline for the header, from every save on the day (mutations keyed "save").
 * Offline = the latest save failed because there was no internet.
 */
export function useSaveState(): SaveState {
  const saving = useIsMutating({ mutationKey: ["save"] });
  const latest = useMutationState({
    filters: { mutationKey: ["save"] },
    select: (m) => ({ status: m.state.status, error: m.state.error as Error | null, at: m.state.submittedAt }),
  })
    .sort((a, b) => a.at - b.at)
    .at(-1);
  if (saving > 0) return "saving";
  if (latest?.status === "error" && latest.error?.message.startsWith("No internet")) return "offline";
  return "saved";
}
