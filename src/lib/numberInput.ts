/**
 * Checking a number the manager typed, before it is saved. Kept as text all the way
 * (hard rule 3): "128.5" stays "128.5", never 128.49999.
 */

export type TypedNumber =
  | { kind: "empty" }
  | { kind: "ok"; value: string }
  | { kind: "bad"; message: string };

/**
 * `decimals`: most digits allowed after the point (1 for dips, 2 for litres and rupees).
 * Commas and spaces are ignored, so "13,250" is read as 13250. Negative numbers are refused (H5).
 */
export function readTypedNumber(raw: string, decimals: number): TypedNumber {
  const text = raw.replace(/[,\s]/g, "");
  if (text === "") return { kind: "empty" };
  if (text.startsWith("-") || text.startsWith("−")) return { kind: "bad", message: "Can't be negative." };
  if (!/^\d*\.?\d*$/.test(text) || text === ".") return { kind: "bad", message: "Type a number, like 128.5." };
  const [whole, rawFrac = ""] = text.split(".");
  const frac = rawFrac.replace(/0+$/, ""); // "128.50" is the same reading as "128.5"
  if (frac.length > decimals) {
    return {
      kind: "bad",
      message: decimals === 1 ? "Only 1 digit after the point, like 128.5." : `At most ${decimals} digits after the point.`,
    };
  }
  const cleanWhole = whole.replace(/^0+(?=\d)/, "") || "0";
  return { kind: "ok", value: frac ? `${cleanWhole}.${frac}` : cleanWhole };
}
