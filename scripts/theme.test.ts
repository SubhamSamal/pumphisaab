import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildTheme, hexToChannels } from "./theme.mjs";

const tokens = JSON.parse(readFileSync("docs/design-tokens.json", "utf8"));
const generated = JSON.parse(readFileSync("src/theme/tokens.generated.json", "utf8"));

describe("theme from design tokens", () => {
  it("committed theme matches docs/design-tokens.json (run `npm run theme` if this fails)", () => {
    expect(generated).toEqual(buildTheme(tokens));
  });

  it("light and dark have the same colour names", () => {
    expect(Object.keys(generated.colors.dark).sort()).toEqual(Object.keys(generated.colors.light).sort());
  });

  it("has the colours and sizes the design relies on", () => {
    expect(generated.colors.light.primary).toBe("#0F766E");
    expect(generated.colors.dark.bg).toBe("#0B1220");
    expect(generated.text["number-input"]).toEqual({ fontSize: 24, lineHeight: 32, fontWeight: "600" });
    expect(generated.size["tap-min"]).toBe(48);
    expect(generated.size["nozzle-row-h"]).toBe(64);
  });

  it("converts hex to NativeWind channels", () => {
    expect(hexToChannels("#0F766E")).toBe("15 118 110");
    expect(() => hexToChannels("teal")).toThrow();
  });
});
