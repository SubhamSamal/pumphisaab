import { expect, it } from "vitest";
import { newId } from "./uuid";

it("makes a fresh id in the database's uuid format every time", () => {
  const ids = new Set(Array.from({ length: 200 }, newId));
  expect(ids.size).toBe(200);
  for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
