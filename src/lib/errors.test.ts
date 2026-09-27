import { expect, it } from "vitest";
import { friendlyError } from "./errors";

it("turns technical errors into one plain sentence", () => {
  expect(friendlyError({ message: "Invalid login credentials" })).toBe("Username or password is wrong. Check and try again.");
  expect(friendlyError({ message: "User is banned" })).toBe("This login is switched off. Ask the owner.");
  expect(friendlyError(new TypeError("Network request failed"))).toBe("No internet. Check the connection and try again.");
  expect(friendlyError({ code: "40001", message: "x" })).toBe("Someone else changed this just now. Reload and try again.");
  expect(friendlyError({ code: "42501", message: "new row violates row-level security policy" })).toBe("You don't have permission to do that.");
  expect(friendlyError({ code: "23505", message: "duplicate key value" })).toBe("That name is already there.");
  expect(friendlyError({ code: "23514", message: "violates check constraint" })).toBe("That number can't be negative. Check it.");
  expect(friendlyError({ code: "P0001", message: "This day is locked. Ask the owner to unlock it." })).toBe("This day is locked. Ask the owner to unlock it.");
  expect(friendlyError({ code: "PGRST202", message: "Could not find the function public.open_day" })).toBe(
    "The app is newer than the database. The owner needs to paste the latest database update.",
  );
  expect(friendlyError({ code: "23505", message: "Slip 4471 is already saved for Mahanadi Coalfields. Check the slip number." })).toBe(
    "Slip 4471 is already saved for Mahanadi Coalfields. Check the slip number.",
  );
  expect(friendlyError({ message: "weird" })).toBe("Something went wrong. Try again.");
});
