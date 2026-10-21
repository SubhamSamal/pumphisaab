import { describe, expect, it } from "vitest";
import { updateMessage } from "./updateMessage";

describe("Check for update (Profile)", () => {
  it("says plainly what happened", () => {
    expect(updateMessage({ kind: "idle" })).toBeNull();
    expect(updateMessage({ kind: "latest" })).toBe("You have the latest version.");
    expect(updateMessage({ kind: "downloading" })).toBe("New version found. Downloading; the app reopens by itself.");
    expect(updateMessage({ kind: "failed" })).toBe("Couldn't check. Check the internet and try again.");
    expect(updateMessage({ kind: "notHere" })).toBe("Updates work only in the installed app.");
  });
});
