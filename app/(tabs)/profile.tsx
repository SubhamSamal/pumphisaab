import { useRouter } from "expo-router";
import { View } from "react-native";
import { Button, Card, ScreenBody, SegmentedControl, Text } from "@/components/ui";
import { useRole, type Role } from "@/features/session/RoleProvider";
import { MainHeader } from "@/features/shell/MainHeader";
import { useTheme } from "@/theme/ThemeProvider";
import type { ThemePreference } from "@/theme/theme";

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "auto", label: "Auto" },
] as const satisfies readonly { value: ThemePreference; label: string }[];

const ROLE_OPTIONS = [
  { value: "manager", label: "Manager" },
  { value: "owner", label: "Owner" },
] as const satisfies readonly { value: Role; label: string }[];

export default function ProfileScreen() {
  const { preference, setPreference } = useTheme();
  const { role, setDevRole } = useRole();
  const router = useRouter();

  return (
    <>
      <MainHeader title="Profile" />
      <ScreenBody>
        <View className="gap-8">
          <Text variant="label" tone="secondary">
            Screen
          </Text>
          <SegmentedControl options={THEME_OPTIONS} value={preference} onChange={setPreference} />
        </View>

        {__DEV__ ? (
          <Card tone="summary">
            <Text variant="heading">Developer only</Text>
            <Text variant="body" tone="secondary">
              Not shown in the real app. Preview the owner or manager tabs until login arrives in Phase 2.
            </Text>
            <SegmentedControl options={ROLE_OPTIONS} value={role} onChange={setDevRole} />
            <Button label="Open component gallery" variant="secondary" size="M" onPress={() => router.push("/gallery")} />
          </Card>
        ) : null}
      </ScreenBody>
    </>
  );
}
