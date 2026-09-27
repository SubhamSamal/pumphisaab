import { expect, it } from "vitest";
import { fromShown, readTypedNumber, showTyped } from "./numberInput";

it("reads typed numbers as exact text", () => {
  expect(readTypedNumber("", 1)).toEqual({ kind: "empty" });
  expect(readTypedNumber("  ", 1)).toEqual({ kind: "empty" });
  expect(readTypedNumber("128.5", 1)).toEqual({ kind: "ok", value: "128.5" });
  expect(readTypedNumber("128.50", 1)).toEqual({ kind: "ok", value: "128.5" });
  expect(readTypedNumber("055.0", 1)).toEqual({ kind: "ok", value: "55" });
  expect(readTypedNumber("13,250", 2)).toEqual({ kind: "ok", value: "13250" });
  expect(readTypedNumber(".5", 1)).toEqual({ kind: "ok", value: "0.5" });
  expect(readTypedNumber("7.", 1)).toEqual({ kind: "ok", value: "7" });
});

it("refuses what can't be a reading", () => {
  expect(readTypedNumber("128.55", 1)).toMatchObject({ kind: "bad", message: "Only 1 digit after the point, like 128.5." });
  expect(readTypedNumber("1.234", 2)).toMatchObject({ kind: "bad" });
  expect(readTypedNumber("-5", 2)).toMatchObject({ kind: "bad", message: "Can't be negative." });
  expect(readTypedNumber("12a", 2)).toMatchObject({ kind: "bad" });
  expect(readTypedNumber("1.2.3", 2)).toMatchObject({ kind: "bad" });
  expect(readTypedNumber(".", 1)).toMatchObject({ kind: "bad" });
});

it("shows Indian commas while typing, and takes them out again", () => {
  expect(showTyped("")).toBe("");
  expect(showTyped("999")).toBe("999");
  expect(showTyped("1000")).toBe("1,000");
  expect(showTyped("126942.71")).toBe("1,26,942.71");
  expect(showTyped("12345678")).toBe("1,23,45,678");
  expect(showTyped("100000.")).toBe("1,00,000.");
  expect(showTyped("5.0")).toBe("5.0");
  expect(showTyped("12a")).toBe("12a");
  expect(fromShown("1,26,942.71")).toBe("126942.71");
  expect(fromShown(showTyped("100000."))).toBe("100000.");
});
