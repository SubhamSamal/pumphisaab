import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MINUS } from "@/lib/format";
import { evaluateDay, explainReceived, explainSoldAsPerMeters, explainSoldAsPerTank } from ".";

const notebook = JSON.parse(readFileSync(join(__dirname, "../../tests/golden/cases/notebook-2026-09-15.json"), "utf8"));
const chart = JSON.parse(readFileSync(join(__dirname, "../../tests/golden/charts/iocl-20kl.json"), "utf8")).rows.map(
  ([dipCm, litres]: string[]) => ({ dipCm, litres }),
);
const day = { ...notebook.input, tanks: notebook.input.tanks.map((t: object) => ({ ...t, chart })) };

describe("written-out sums (what the screens show)", () => {
  const result = evaluateDay(day);
  const hsd = result.products.find((p) => p.product === "HSD")!;

  it("sold as per tank, as a sum anyone can check by hand", () => {
    expect(explainSoldAsPerTank(hsd)).toBe("Opening 5,074.74 + tanker 13,972 − closing 12,749.18 = 6,297.56 L");
  });

  it("sold as per meters, with testing taken off", () => {
    expect(explainSoldAsPerMeters(hsd)).toBe("Meters 6,260.45 − testing 10 = 6,250.45 L");
  });

  it("each part of a shift's Received, ending in the total", () => {
    const lines = explainReceived(result.shifts[0]);
    expect(lines[0]).toEqual({ label: "Cash counted", amount: "₹22,919.99" });
    expect(lines[1]).toEqual({ label: "Less cash already in the drawer", amount: `${MINUS}₹36,013.04` });
    expect(lines.at(-1)).toEqual({ label: "Received", amount: "₹6,60,664.52" });
  });

  it("flag messages use pump words, never ask for a reason, and never use a hyphen as minus", () => {
    const all = [...result.flags, ...result.hardErrors].map((i) => i.message).join(" ");
    expect(all).toContain("Diesel short 47.11 L (0.75%)");
    expect(all.toLowerCase()).not.toMatch(/reason|variance|reconcil|debit/);
  });
});

describe("engine boundaries (CLAUDE.md folder map)", () => {
  it("src/calc never imports React, React Native or Supabase", () => {
    const files = readdirSync(__dirname).filter((f) => f.endsWith(".ts"));
    for (const f of files) {
      const text = readFileSync(join(__dirname, f), "utf8");
      expect(text, f).not.toMatch(/from ["'](react|react-native|@supabase\/[^"']+|expo[^"']*)["']/);
    }
  });

  it("no limit is written anywhere except rules.ts", () => {
    const files = readdirSync(__dirname).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "rules.ts");
    for (const f of files) {
      const text = readFileSync(join(__dirname, f), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      // Limits would look like "0.5", "100", "4" or 0.3 inside code; allow 0, 1, 2 and 100 (for percent maths).
      expect(text, f).not.toMatch(/["'](0\.\d+|[3-9]|\d{3,})["']/);
    }
  });
});
