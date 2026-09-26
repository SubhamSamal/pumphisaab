import { describe, expect, it } from "vitest";
import { isValidUsername, loginEmail, normaliseUsername, usernameProblem } from "./username";

describe("usernames", () => {
  it("are stored trimmed and lower-case", () => {
    expect(normaliseUsername("  Ramesh.M ")).toBe("ramesh.m");
  });

  it("map to a hidden email on the owner's domain", () => {
    expect(loginEmail("Subham")).toBe("subham@users.pumphisaab.com");
  });

  it("accept letters, numbers, dot and underscore", () => {
    for (const ok of ["subham", "ramesh.m", "manager.test", "a_b1"]) expect(isValidUsername(ok)).toBe(true);
    for (const bad of ["ab", ".ramesh", "ram esh", "ramesh@x", "RAMESH", "x".repeat(31)]) expect(isValidUsername(bad)).toBe(false);
  });

  it("explain what's wrong in plain words", () => {
    expect(usernameProblem("ab")).toBe("Use at least 3 letters or numbers.");
    expect(usernameProblem("ram esh")).toMatch(/only letters, numbers, dot and underscore/);
    expect(usernameProblem("Ramesh.M")).toBeNull();
  });
});
