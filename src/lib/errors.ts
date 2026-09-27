/**
 * Turns technical errors into one plain sentence that says what to do (design system: Alerts).
 */

type ErrorLike = { message?: string; code?: string; status?: number; name?: string } | null | undefined;

export function friendlyError(error: unknown, fallback = "Something went wrong. Try again."): string {
  const e = error as ErrorLike;
  const message = (e?.message ?? "").toLowerCase();

  if (message.includes("invalid login credentials")) return "Username or password is wrong. Check and try again.";
  if (message.includes("banned")) return "This login is switched off. Ask the owner.";
  if (message.includes("network request failed") || message.includes("failed to fetch") || message.includes("fetch failed"))
    return "No internet. Check the connection and try again.";
  if (e?.code === "40001" || message.includes("someone else changed this")) return "Someone else changed this just now. Reload and try again.";
  if (e?.code === "42501" || message.includes("row-level security") || message.includes("permission denied"))
    return "You don't have permission to do that.";
  if (e?.code === "23505" || message.includes("duplicate key")) return "That name is already there.";
  if (e?.code === "23514" || message.includes("violates check constraint")) return "That number can't be negative. Check it.";
  // The app was updated before its database change was pasted in Supabase (missing table, column or function).
  if (["42P01", "42703", "42883", "PGRST202", "PGRST204", "PGRST205"].includes(e?.code ?? ""))
    return "The app is newer than the database. The owner needs to paste the latest database update.";
  // Our own database checks already speak plain English ("This day is locked. Ask the owner to unlock it.").
  if (e?.code === "P0001" && e.message) return e.message;
  return fallback;
}
