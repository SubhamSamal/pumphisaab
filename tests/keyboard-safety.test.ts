/**
 * The keyboard must never cover the box being typed in, or the button needed next
 * (owner found this twice on Android on 27 Sep: Opening dip, then Sign in).
 *
 * The fix lives in ONE place: src/components/ui/Screen.tsx (ScreenBody / KeyboardSafeScroll) and
 * BottomSheet. This test fails if any screen skips it, so the mistake can't come back unnoticed.
 * Rules and why: CLAUDE.md "Keyboard" rule, docs/learnings.md section 6.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

// Screens and feature code. Design-system components (src/components/ui) are where the fix lives.
const files = [...tsxFiles(join(ROOT, "app")), ...tsxFiles(join(ROOT, "src/features"))].map((path) => ({
  name: relative(ROOT, path),
  code: readFileSync(path, "utf8"),
}));

const TYPING_BOX = /<(TextField|NumericInput|DipInput|TextInput)\b/;
const KEYBOARD_SAFE = /<(ScreenBody|KeyboardSafeScroll)\b/;

describe("keyboard never covers what's being typed", () => {
  it("finds the screens to check", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const f of files) {
    it(`${f.name}: scrolls only through the keyboard-safe parts`, () => {
      // A raw ScrollView or KeyboardAvoidingView would skip the Android fix.
      const rawImport = /import\s*{[^}]*\b(ScrollView|KeyboardAvoidingView)\b[^}]*}\s*from\s*"react-native"/.test(f.code);
      expect(rawImport, "use ScreenBody or KeyboardSafeScroll from @/components/ui instead").toBe(false);

      if (TYPING_BOX.test(f.code)) {
        expect(KEYBOARD_SAFE.test(f.code), "a screen with a typing box must be inside ScreenBody or KeyboardSafeScroll").toBe(true);
      }
    });
  }
});
