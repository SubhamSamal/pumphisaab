import { expect, it } from "vitest";
import { countUses, matchNamed, normName } from "./customers";

const c = (name: string, uses = 0, isActive = true) => ({ id: name, name, isActive, uses });
const list = [c("ABC Traders", 1), c("ABCD Logistics", 7), c("Mahanadi ABC", 3), c("SVT"), c("Old ABC Co", 9, false)];

it("shows every company that matches, names starting with the typed text first", () => {
  expect(matchNamed(list, "abc").map((x) => x.name)).toEqual(["ABC Traders", "ABCD Logistics", "Mahanadi ABC"]);
  expect(matchNamed(list, "  ABCD ").map((x) => x.name)).toEqual(["ABCD Logistics"]);
  expect(matchNamed(list, "xyz")).toEqual([]);
});

it("with nothing typed shows only the 2 most used, never a stopped one (owner, 29 Sep)", () => {
  expect(matchNamed(list, "").map((x) => x.name)).toEqual(["ABCD Logistics", "Mahanadi ABC"]);
  expect(matchNamed([c("New"), c("Newer")], "")).toEqual([]);
  expect(matchNamed(list, "old")).toEqual([]);
});

it("counts uses and treats extra spaces and capitals as the same name", () => {
  expect(countUses(["a", "b", "a", null])).toEqual({ a: 2, b: 1 });
  expect(normName("  Dord   logistics ")).toBe(normName("Dord Logistics"));
});
