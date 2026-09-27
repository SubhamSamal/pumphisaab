/**
 * Typed text must never be cut off on any side (owner, 27 + 28 Sep: big numbers lost their top,
 * a "0" looked like "U"). The fix lives in ONE place: `typingText` in src/components/ui/Field.tsx.
 * This test fails if any typing box skips it. Why: docs/learnings.md section 6.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const tsxFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? tsxFiles(path) : path.endsWith(".tsx") ? [path] : [];
  });

const files = ["app", "src"].flatMap((d) => tsxFiles(join(ROOT, d))).map((path) => ({ name: relative(ROOT, path), code: readFileSync(path, "utf8") }));

describe("typed text is never cut off", () => {
  const withInputs = files.filter((f) => /<TextInput\s/.test(f.code));
  it("finds the typing boxes", () => expect(withInputs.length).toBeGreaterThanOrEqual(4));

  for (const f of withInputs) {
    it(`${f.name}: every TextInput uses typingText`, () => {
      const blocks = f.code.split(/<TextInput\s/).slice(1).map((b) => b.slice(0, b.indexOf("/>")));
      for (const b of blocks) expect(b, `A TextInput in ${f.name} without typingText`).toMatch(/\btypingText\b/);
    });
  }

  it("typingText fills the box and drops Android's font padding", () => {
    const field = readFileSync(join(ROOT, "src/components/ui/Field.tsx"), "utf8");
    const def = field.slice(field.indexOf("export const typingText"), field.indexOf("};", field.indexOf("export const typingText")));
    for (const rule of ["includeFontPadding: false", 'textAlignVertical: "center"', 'alignSelf: "stretch"', "padding: 0"]) expect(def).toContain(rule);
  });
});
