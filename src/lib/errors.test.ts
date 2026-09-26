import { expect, it } from "vitest";
import { friendlyError } from "./errors";

it("turns technical errors into one plain sentence", () => {
  expect(friendlyError({ message: "Invalid login credentials" })).toBe("Username or password is wrong. Check and try again.");
  expect(friendlyError({ message: "User is banned" })).toBe("This login is switched off. Ask the owner.");
  expect(friendlyError(new TypeError("Network request failed"))).toBe("No internet. Check the connection and try again.");
  expect(friendlyError({ code: "40001", message: "x" })).toBe("Someone else changed this just now. Reload and try again.");
  expect(friendlyError({ code: "42501", message: "new row violates row-level security policy" })).toBe("You don't have permission to do that.");
  expect(friendlyError({ code: "23505", message: "duplicate key value" })).toBe("That name is already there.");
  expect(friendlyError({ message: "weird" })).toBe("Something went wrong. Try again.");
});
