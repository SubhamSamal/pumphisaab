/** Words for the Profile "Check for update" button (pure, so it can be tested without the phone). */

export type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "latest" }
  | { kind: "downloading" }
  | { kind: "notHere" }
  | { kind: "failed" };

/** What the Profile button says for each state. */
export function updateMessage(state: UpdateState): string | null {
  switch (state.kind) {
    case "checking":
      return "Checking…";
    case "latest":
      return "You have the latest version.";
    case "downloading":
      return "New version found. Downloading; the app reopens by itself.";
    case "notHere":
      return "Updates work only in the installed app.";
    case "failed":
      return "Couldn't check. Check the internet and try again.";
    default:
      return null;
  }
}
