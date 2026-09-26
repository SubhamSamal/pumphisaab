/**
 * Usernames and the hidden email behind them.
 *
 * People sign in with a username only. Supabase needs an email, so each username gets a hidden
 * one on a domain the owner controls (decision D36). No email is ever sent to it.
 * The same rule is in the database (pump_members.username) and the create-user function.
 */

export const USERNAME_RULE = /^[a-z0-9][a-z0-9._]{2,29}$/;
export const LOGIN_EMAIL_DOMAIN = "users.pumphisaab.com";
export const MIN_PASSWORD_LENGTH = 8;

/** What people type → the stored form: trimmed and lower-case ("Ramesh.M " → "ramesh.m"). */
export function normaliseUsername(typed: string): string {
  return typed.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_RULE.test(username);
}

/** "ramesh.m" → "ramesh.m@users.pumphisaab.com" */
export function loginEmail(username: string): string {
  return `${normaliseUsername(username)}@${LOGIN_EMAIL_DOMAIN}`;
}

/** Plain-English problem with a username, or null if it's fine. */
export function usernameProblem(typed: string): string | null {
  const u = normaliseUsername(typed);
  if (u.length < 3) return "Use at least 3 letters or numbers.";
  if (u.length > 30) return "Use 30 characters or fewer.";
  if (!isValidUsername(u)) return "Use only letters, numbers, dot and underscore, starting with a letter or number.";
  return null;
}
