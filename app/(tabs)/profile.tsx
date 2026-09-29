import Constants from "expo-constants";
import { useRouter } from "expo-router";
import * as Updates from "expo-updates";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button, Card, ListItem, ScreenBody, SegmentedControl, Text } from "@/components/ui";
import { useMembership, useSession } from "@/features/session/SessionProvider";
import { MainHeader } from "@/features/shell/MainHeader";
import { sendTestReport } from "@/lib/crashReports";
import { useTheme } from "@/theme/ThemeProvider";
import type { ThemePreference } from "@/theme/theme";

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "auto", label: "Auto" },
] as const satisfies readonly { value: ThemePreference; label: string }[];

/** "App 1.0.0 · preview · built-in code" or "… · update 3f2a91c (over the air)": which code this phone runs (4g). */
function versionLine() {
  const variant = (Constants.expoConfig?.extra as { variant?: string } | undefined)?.variant ?? "development";
  // The code inside the installed app has an id too; only a downloaded update says "over the air".
  const update = !Updates.isEmbeddedLaunch && Updates.updateId ? `update ${Updates.updateId.slice(0, 7)} (over the air)` : "built-in code";
  return `App ${Constants.expoConfig?.version ?? "?"} · ${variant} · ${update}`;
}

/** Canvas Flow 13 · Profile. Managers see their name, Staff, Screen and Sign out. */
export default function ProfileScreen() {
  const { preference, setPreference } = useTheme();
  const { signOut } = useSession();
  const me = useMembership();
  const router = useRouter();
  const isOwner = me.role === "owner";
  // Tap the version line 5 times: a hidden button to prove crash reports arrive (4g).
  const [taps, setTaps] = useState(0);
  const [testSent, setTestSent] = useState<string | null>(null);

  return (
    <>
      <MainHeader title="Profile" />
      <ScreenBody>
        <View className="gap-4">
          <Text variant="heading">{me.fullName}</Text>
          <Text variant="label" weight="400" tone="secondary">
            {isOwner ? "Owner" : "Manager"} · username {me.username} · {me.pump.name}
          </Text>
        </View>

        <View>
          {isOwner ? (
            <ListItem title="Logins" detail="Owner and managers" icon="user" onPress={() => router.push("/profile/logins")} />
          ) : null}
          <ListItem title="Staff" detail="Attendants for each shift" icon="user" onPress={() => router.push("/profile/staff")} />
        </View>

        <View className="gap-8">
          <Text variant="label" tone="secondary">
            Screen
          </Text>
          <SegmentedControl options={THEME_OPTIONS} value={preference} onChange={setPreference} />
        </View>

        <Button label="Sign out" variant="secondary" icon="signOut" onPress={signOut} />

        <Pressable onPress={() => setTaps((n) => n + 1)} accessibilityLabel="App version">
          <Text variant="label" weight="400" tone="muted" className="text-center">
            {versionLine()}
          </Text>
        </Pressable>
        {taps >= 5 ? (
          <View className="gap-8">
            <Button
              label="Send a test crash report"
              variant="secondary"
              size="M"
              onPress={() => setTestSent(sendTestReport() ? "Sent. It shows in Sentry within a minute." : "Crash reports are only on in the installed app.")}
            />
            {testSent ? (
              <Text variant="label" weight="400" tone="secondary" className="text-center">
                {testSent}
              </Text>
            ) : null}
          </View>
        ) : null}

        {__DEV__ ? (
          <Card tone="summary">
            <Text variant="heading">Developer only</Text>
            <Text variant="body" tone="secondary">
              Not shown in the real app.
            </Text>
            <Button label="Open component gallery" variant="secondary" size="M" onPress={() => router.push("/gallery")} />
          </Card>
        ) : null}
      </ScreenBody>
    </>
  );
}
