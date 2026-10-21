import * as Updates from "expo-updates";
import { useState } from "react";
import { track } from "@/lib/analytics";
import type { UpdateState } from "./updateMessage";

export { updateMessage, type UpdateState } from "./updateMessage";

/**
 * "Check for update" (owner, 21 Oct): asks for a newer over-the-air update; if there is one it is
 * downloaded and the app reopens on it, so nobody has to close and reopen the app twice.
 */
export function useAppUpdate() {
  const [state, setState] = useState<UpdateState>({ kind: "idle" });

  const check = async () => {
    if (!Updates.isEnabled) {
      setState({ kind: "notHere" });
      return;
    }
    setState({ kind: "checking" });
    try {
      const found = await Updates.checkForUpdateAsync();
      if (!found.isAvailable) {
        setState({ kind: "latest" });
        return;
      }
      setState({ kind: "downloading" });
      await Updates.fetchUpdateAsync();
      track("app_update_installed");
      await Updates.reloadAsync();
    } catch {
      setState({ kind: "failed" });
    }
  };

  return { state, check, busy: state.kind === "checking" || state.kind === "downloading" };
}
