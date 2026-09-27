import { Pressable, View } from "react-native";
import { Icon } from "./Icon";
import { Text } from "./Text";

export type DateStepperProps = {
  /** Already formatted: "Thu, 01 Oct 2026". */
  label: string;
  /** Small line under the date ("Today", "2 days ago"). */
  caption?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  canPrevious?: boolean;
  canNext?: boolean;
};

function Arrow({ dir, onPress, enabled }: { dir: "left" | "right"; onPress?: () => void; enabled: boolean }) {
  return (
    <Pressable
      onPress={enabled ? onPress : undefined}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={dir === "left" ? "Day before" : "Day after"}
      accessibilityState={{ disabled: !enabled }}
      className={`h-tap w-[48px] items-center justify-center rounded-sm border border-border ${enabled ? "bg-bg" : "bg-surface"}`}
    >
      <Icon name={dir === "left" ? "chevronLeft" : "chevronRight"} color={enabled ? "text-primary" : "text-muted"} />
    </Pressable>
  );
}

/** Pick a business day one step at a time (decision D14 "date field"). The date is never typed. */
export function DateStepper({ label, caption, onPrevious, onNext, canPrevious = true, canNext = true }: DateStepperProps) {
  return (
    <View className="flex-row items-center gap-8">
      <Arrow dir="left" onPress={onPrevious} enabled={canPrevious} />
      <View className="min-w-0 flex-1 items-center">
        <Text variant="body" weight="600">
          {label}
        </Text>
        {caption ? (
          <Text variant="label" weight="400" tone="secondary">
            {caption}
          </Text>
        ) : null}
      </View>
      <Arrow dir="right" onPress={onNext} enabled={canNext} />
    </View>
  );
}
