import { useRouter } from "expo-router";
import { View } from "react-native";
import { Button, Card, ListItem, ScreenBody, SegmentedControl, Text } from "@/components/ui";
import { useMembership, useSession } from "@/features/session/SessionProvider";
import { MainHeader } from "@/features/shell/MainHeader";
import { useTheme } from "@/theme/ThemeProvider";
import type { ThemePreference } from "@/theme/theme";

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "auto", label: "Auto" },
] as const satisfies readonly { value: ThemePreference; label: string }[];

/** Canvas Flow 13 · Profile. Managers see their name, Staff, Screen and Sign out. */
export default function ProfileScreen() {
  const { preference, setPreference } = useTheme();
  const { signOut } = useSession();
  const me = useMembership();
  const router = useRouter();
  const isOwner = me.role === "owner";

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
