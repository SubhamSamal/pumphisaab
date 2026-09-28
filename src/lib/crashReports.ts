/**
 * Crash reports (Sentry, D52, D89). Only the installed preview and production apps send them:
 * not the dev app, not web. No personal data: no usernames, emails or typed numbers, only the
 * error, the screen and the phone model (sendDefaultPii off, request bodies never attached).
 */
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const variant = (Constants.expoConfig?.extra as { variant?: string } | undefined)?.variant ?? "development";

export const crashReportsOn = Boolean(dsn) && !__DEV__ && Platform.OS !== "web";

export function startCrashReports() {
  if (!crashReportsOn) return;
  Sentry.init({
    dsn,
    environment: variant,
    release: `pumphisaab@${Constants.expoConfig?.version ?? "0"}`,
    dist: Updates.updateId ?? "embedded",
    sendDefaultPii: false,
    // Console lines can hold typed numbers; keep them out.
    beforeBreadcrumb: (b) => (b.category === "console" ? null : b),
  });
}

/** The hidden "Send a test crash report" in Profile (to prove reports arrive). */
export function sendTestReport(): boolean {
  if (!crashReportsOn) return false;
  Sentry.captureException(new Error("Test crash report from Profile (owner's check, not a real problem)"));
  return true;
}

export const withCrashReports = (App: () => React.JSX.Element | null) => (crashReportsOn ? Sentry.wrap(App) : App);
