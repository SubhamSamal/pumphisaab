import { ActivityIndicator, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon } from "./Icon";
import { Text } from "./Text";

export type SaveState = "saved" | "saving" | "offline";

/** Icon + word: Saved (green), Saving… (neutral), Offline (amber), "Offline · 3 waiting" when saves wait on the phone. */
export function SaveIndicator({ state, waiting = 0 }: { state: SaveState; waiting?: number }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center gap-4" accessibilityLiveRegion="polite">
      {state === "saved" ? <Icon name="check" size="small" color="success" /> : null}
      {state === "saving" ? <ActivityIndicator size="small" color={colors["text-secondary"]} /> : null}
      {state === "offline" ? <Icon name="offline" size="small" color="warning" /> : null}
      <Text variant="label" tone={state === "saved" ? "success" : state === "offline" ? "warning" : "secondary"}>
        {state === "saved" ? "Saved" : state === "saving" ? "Saving…" : waiting > 0 ? `Offline · ${waiting} waiting` : "Offline"}
      </Text>
    </View>
  );
}
