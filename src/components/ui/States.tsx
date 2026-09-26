import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, View, type DimensionValue } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

/** Grey block in the shape of what's loading, so nothing jumps. Shimmer stops with reduced motion. */
export function Skeleton({ height, width = "100%" }: { height: number; width?: DimensionValue }) {
  const { colors } = useTheme();
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (reduced) return;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
          ]),
        );
        loop.start();
      })
      .catch(() => {});
    return () => loop?.stop();
  }, [opacity]);
  // Animated.View doesn't take className, so the fill comes from the theme hook.
  return (
    <View className="overflow-hidden rounded-sm" style={{ height, width }}>
      <Animated.View style={{ flex: 1, backgroundColor: colors["auto-field-bg"], opacity }} />
    </View>
  );
}

/** One icon, one line, one action (plus an optional "none today" action). No illustration. */
export function EmptyState({
  icon,
  title,
  body,
  action,
  secondary,
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
}) {
  return (
    <View className="items-center gap-16 px-16 py-32">
      <Icon name={icon} size="large" color="text-secondary" />
      <View className="items-center gap-4">
        <Text variant="heading" className="text-center">
          {title}
        </Text>
        {body ? (
          <Text variant="body" tone="secondary" className="text-center">
            {body}
          </Text>
        ) : null}
      </View>
      {action ? <Button label={action.label} onPress={action.onPress} size="M" align="center" /> : null}
      {secondary ? <Button label={secondary.label} onPress={secondary.onPress} size="M" variant="secondary" align="center" /> : null}
    </View>
  );
}

/** What went wrong, one retry button, and a promise that typed numbers are safe. */
export function ErrorState({ title, body, onRetry }: { title: string; body: string; onRetry: () => void }) {
  return (
    <View className="items-center gap-16 px-16 py-32">
      <Icon name="error" size="large" color="danger" />
      <View className="items-center gap-4">
        <Text variant="heading" className="text-center">
          {title}
        </Text>
        <Text variant="body" tone="secondary" className="text-center">
          {body}
        </Text>
      </View>
      <Button label="Try again" icon="retry" onPress={onRetry} size="M" variant="secondary" align="center" />
    </View>
  );
}
