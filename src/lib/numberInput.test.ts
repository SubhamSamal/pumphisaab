import { expect, it } from "vitest";
import { readTypedNumber } from "./numberInput";

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
