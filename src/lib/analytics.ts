/**
 * Product events from the PRD ("Tracking and Instrumentation").
 *
 * Screens call track() at the moments the PRD lists. Nothing is sent anywhere yet:
 * PostHog is plugged in here in Phase 6, and no screen has to change then.
 */

export type EventName =
  | "day_opened"
  | "price_confirmed"
  | "section_opened"
  | "section_completed"
  | "sales_done_tapped"
  | "field_autosaved"
  | "draft_save_failed"
  | "hard_error_shown"
  | "meter_change_requested"
  | "meter_change_approved"
  | "day_submitted"
  | "day_locked"
  | "day_unlocked"
  | "tanker_receipt_added"
  | "credit_sale_added"
  | "expense_added";

type Props = Record<string, string | number | boolean | null | undefined>;

export function track(event: EventName, props: Props = {}): void {
  if (__DEV__ && process.env.NODE_ENV !== "test") console.log(`[event] ${event}`, props);
}
