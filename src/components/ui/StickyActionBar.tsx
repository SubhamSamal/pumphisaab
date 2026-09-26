import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { shadow } from "@/theme/theme";

/**
 * Bottom bar that holds the screen's one primary action, with an optional line above it
 * (save state, or why the button is disabled). One of only two things that cast a shadow.
 */
export function StickyActionBar({ children, note }: { children: ReactNode; note?: ReactNode }) {
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      className="gap-8 bg-bg px-16 pt-12"
      style={{ paddingBottom: Math.max(12, insets.bottom), boxShadow: shadow.sticky[scheme] }}
    >
      {note}
      {children}
    </View>
  );
}
