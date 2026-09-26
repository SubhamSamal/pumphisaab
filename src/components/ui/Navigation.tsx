import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "./Icon";
import { LogoMark } from "./Logo";
import { Text } from "./Text";

/** Bell, top right of every main screen. Red count badge, capped at 9+. */
export function BellButton({ count = 0, onPress }: { count?: number; onPress?: () => void }) {
  const label = count > 0 ? `Alerts, ${count} new` : "Alerts";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="-mr-12 h-tap w-[48px] items-center justify-center"
    >
      <Icon name="bell" size="nav" />
      {count > 0 ? (
        <View className="absolute right-4 top-4 h-20 min-w-[20px] items-center justify-center rounded-full bg-danger px-[5px]">
          <Text variant="caption" weight="600" tone="onDanger">
            {count > 9 ? "9+" : String(count)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Screen header, 64 px. Either a single `title`, or `title` + `subtitle` (pump name over the date on Today).
 * Back arrow on pushed screens; the bell and any actions on the right.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  wide,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  /** Web ≥1024: 24 px side padding like the canvas web bar. */
  wide?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View className="border-b border-border bg-bg" style={{ paddingTop: insets.top }}>
      <View className={`min-h-[64px] flex-row items-center gap-8 py-8 ${wide ? "px-24" : "px-16"}`}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="-ml-12 h-tap w-[48px] items-center justify-center"
          >
            <Icon name="chevronLeft" size="nav" />
          </Pressable>
        ) : null}
        <View className="min-w-0 flex-1">
          {subtitle ? (
            <>
              <Text variant="heading" numberOfLines={1}>
                {title}
              </Text>
              <Text variant="label" tone="secondary">
                {subtitle}
              </Text>
            </>
          ) : (
            <Text variant="title" numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
          )}
        </View>
        {right}
      </View>
    </View>
  );
}

export type NavItem = {
  key: string;
  label: string;
  icon: IconName;
  active: boolean;
  onPress: () => void;
};

/** Mobile bottom navigation, 64 px. Active = icon in a teal pill + bold teal label (shape and colour). */
export function BottomNav({ items }: { items: NavItem[] }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-row border-t border-border bg-bg" style={{ paddingBottom: insets.bottom }} accessibilityRole="tablist">
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={item.onPress}
          accessibilityRole="tab"
          accessibilityState={{ selected: item.active }}
          accessibilityLabel={item.label}
          className="h-[64px] flex-1 items-center justify-center gap-[2px]"
        >
          <View className={`h-[28px] w-[56px] items-center justify-center rounded-full ${item.active ? "bg-primary-subtle" : ""}`}>
            <Icon name={item.icon} size="nav" color={item.active ? "primary" : "text-secondary"} />
          </View>
          <Text variant="caption" weight={item.active ? "600" : "500"} tone={item.active ? "accent" : "secondary"}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Web ≥1024 px: the bottom nav becomes this 88 px left rail, logo on top. */
export function SideRail({ items }: { items: NavItem[] }) {
  return (
    <View className="w-rail items-center gap-8 border-r border-border bg-bg py-16" accessibilityRole="tablist">
      <View className="mb-8">
        <LogoMark size={48} />
      </View>
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={item.onPress}
          accessibilityRole="tab"
          accessibilityState={{ selected: item.active }}
          accessibilityLabel={item.label}
          className="w-[72px] items-center gap-[2px] py-[6px]"
        >
          <View className={`h-32 w-[56px] items-center justify-center rounded-full ${item.active ? "bg-primary-subtle" : ""}`}>
            <Icon name={item.icon} size="nav" color={item.active ? "primary" : "text-secondary"} />
          </View>
          <Text variant="caption" weight={item.active ? "600" : "500"} tone={item.active ? "accent" : "secondary"}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
