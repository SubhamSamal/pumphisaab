# Phase 4g plan: preview app, crash reports, over-the-air update

Status: **done 29 Sep 2026**
Parent plan: `docs/plans/archive/phase-4-daily-entry.md` ("Also in this phase"), decisions D43, D44, D52.

## Goal in one line
A real, installable **PumpHisaab app** on your Android phone that works without the Mac, tells us when it crashes (Sentry), and gets fixes **over the air** (no reinstall), proven with one small test update.

## Why now
Until now the Android app you use is the *development* app: it loads the code from the Mac on the same Wi-Fi. A manager at the pump can't use that. The preview app is the one managers will install for the pilot (as an APK, no Play Store, D43).

## What I'll build
1. **Two apps side by side (Q2):** the preview app gets its own name and ID (`PumpHisaab` with a "preview" tag, `com.pumphisaab.app.preview`), so it doesn't replace your development app. `app.json` becomes `app.config.ts` so one file can make both. Production (later) keeps `com.pumphisaab.app` (D34).
2. **Settings for the preview app on EAS:** the Supabase address and public key (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`; both are the public ones already in the app, never the service key) and the Sentry address (DSN).
3. **Sentry** (`@sentry/react-native`, approved D52):
   - Crashes and unexpected errors from the preview and production apps only (not the development app, not web for now).
   - **No personal data:** no usernames, emails or typed numbers are sent; only the error, the screen and the phone model. Plain-language rule in `docs/decisions.md`.
   - "Readable" crash reports (which line of our code) need a Sentry upload key (Q4).
   - A hidden test button (Profile › tap the version 5 times › "Send a test crash report") so we can prove it works.
4. **App icon and splash (Q3):** made from the PumpHisaab drop (teal square, white drop, saffron line) instead of Expo's defaults.
5. **Version line in Profile:** "App 1.0.0 · update <id> · preview", so we can always see which code a phone runs.
6. **Build the preview APK** on EAS (about 15-20 minutes in the cloud) and give you the install link.
7. **Over-the-air test:** after you've installed it, I send one tiny visible change (the version line says "OTA test") with `eas update --channel preview`. You close and reopen the app twice: the change appears without reinstalling.
8. Docs: decisions, learnings, HANDOFF, EXECUTION, owner steps. Checks as always (typecheck, lint, tests, CI).

## What you'll do (full click-by-click steps come with the build)
1. **Sentry account** (free, 5 minutes): sign up at sentry.io with your Gmail, create an organisation `pumphisaab` and a React Native project `pumphisaab-app`, copy the **DSN** (an address starting `https://…ingest…sentry.io/…`) and send it to me. If you pick readable reports (Q4): create an **auth token** in Sentry and paste it yourself into Expo › Project › Environment variables as a secret (I never see it).
2. **Install** the preview APK from the link (Android will ask to allow installing from Chrome/Files once), sign in, and check Today loads.
3. **Test crash:** Profile › tap the version 5 times › Send a test crash report. I confirm it arrived in Sentry.
4. **Over-the-air test:** when I say it's sent, close the app fully and open it, twice. The version line changes to "OTA test". Send a screenshot.
About 30 minutes spread over the session (most of it waiting for the build).

## Not in 4g
- Play Store listing, iPhone app (needs a paid Apple account, D40), web hosting (Phase 7), PostHog (Phase 6).
- Push notifications (Phase 5; they need their own setup and a rebuild then).

## Risks and how they're handled
- **The preview APK replacing the dev app:** avoided by the separate ID (Q2).
- **A bad update breaking the installed app:** updates only go to the `preview` channel, and an update is only for the same app version (runtimeVersion = app version), so it can't reach an app it doesn't fit. A bad update is undone by sending the previous one again (`eas update:republish`).
- **Secrets:** only public keys go into the app; the Sentry auth token stays in EAS as a secret you paste.

## Owner decisions for 4g (MCQ round)
- **D86** Claude runs EAS from the Mac (settings, build, update), telling the owner before each one.
- **D87** Preview app side by side with the dev app: `com.pumphisaab.app.preview`, "PumpHisaab Preview".
- **D88** Icon and splash made from the drop logo now.
- **D89** Readable Sentry reports: the owner creates a Sentry auth token and pastes it into Expo as a secret.
