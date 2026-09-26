import type { ReactNode } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";

/** Web at or above this width gets the left rail and wider padding. */
export const WIDE_MIN = 1024;

export function useIsWide() {
  return useWindowDimensions().width >= WIDE_MIN;
}

/**
 * Scrolling body of a screen. Entry content stays 480 px wide: centred on phones and tablets,
 * left column on wide web (the spare width is for summaries later).
 * With a sticky bar, the bar sits outside the scroll so the last field is never covered.
 */
export function ScreenBody({ children, sticky }: { children: ReactNode; sticky?: ReactNode }) {
  const wide = useIsWide();
  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        className="flex-1"
        contentContainerClassName={wide ? "p-24" : "p-16"}
        keyboardShouldPersistTaps="handled"
      >
        <View className={`w-full max-w-content gap-16 ${wide ? "" : "self-center"}`}>{children}</View>
      </ScrollView>
      {sticky ? (
        <View className={wide ? "items-start px-8" : ""}>
          <View className={`w-full ${wide ? "max-w-[496px]" : ""}`}>{sticky}</View>
        </View>
      ) : null}
    </View>
  );
}
