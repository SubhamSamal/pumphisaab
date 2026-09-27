import { expect, it } from "vitest";
import { matchCustomers, normName } from "./customers";

const c = (name: string, isActive = true) => ({ id: name, name, isActive });
const list = [c("ABC Traders"), c("ABCD Logistics"), c("Mahanadi ABC"), c("SVT"), c("Old ABC Co", false)];

it("shows every company that matches, names starting with the typed text first", () => {
  expect(matchCustomers(list, "abc").map((x) => x.name)).toEqual(["ABC Traders", "ABCD Logistics", "Mahanadi ABC"]);
  expect(matchCustomers(list, "  ABCD ").map((x) => x.name)).toEqual(["ABCD Logistics"]);
  expect(matchCustomers(list, "xyz")).toEqual([]);
});

it("shows the first few when nothing is typed, and never a stopped company", () => {
  expect(matchCustomers(list, "", 2).map((x) => x.name)).toEqual(["ABC Traders", "ABCD Logistics"]);
  expect(matchCustomers(list, "old")).toEqual([]);
});

it("treats extra spaces and capitals as the same name", () => {
  expect(normName("  Dord   logistics ")).toBe(normName("Dord Logistics"));
});
