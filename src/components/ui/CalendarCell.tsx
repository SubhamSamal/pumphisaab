import { Pressable, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import type { ColorName } from "@/theme/theme";
import { Icon, type IconName } from "./Icon";
import { Text, type TextTone } from "./Text";

export type DayResult = "matched" | "late" | "notMatched" | "notSent" | "blank";

const spec: Record<Exclude<DayResult, "blank">, { box: string; tone: TextTone; icon: IconName; color: ColorName; label: string }> = {
  matched: { box: "bg-success-subtle border-success", tone: "success", icon: "check", color: "success", label: "Matched" },
  late: { box: "bg-warning-subtle border-warning", tone: "warning", icon: "clock", color: "warning", label: "Matched late" },
  notMatched: { box: "bg-danger-subtle border-danger", tone: "danger", icon: "warning", color: "danger", label: "Not matched" },
  notSent: { box: "bg-auto-field-bg border-border-strong border-dashed", tone: "secondary", icon: "minus", color: "text-secondary", label: "Not sent" },
};

/** One day of the North Star calendar: fill + border + icon, day number always shown. */
export function CalendarCell({ day, result, today, onPress }: { day: number; result: DayResult; today?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  if (result === "blank") return <View className="h-[52px] flex-1" />;
  const s = spec[result];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${day}, ${s.label}${today ? ", today" : ""}`}
      className={`h-[52px] flex-1 items-center justify-center rounded-sm border-1.5 ${s.box}`}
      style={today ? { boxShadow: `0 0 0 2px ${colors.bg}, 0 0 0 4px ${colors["text-primary"]}` } : undefined}
    >
      <Text variant="label" weight="600" tone={s.tone}>
        {day}
      </Text>
      <Icon name={s.icon} size="small" color={s.color} />
    </Pressable>
  );
}

/** Legend under the calendar. */
export function CalendarLegend() {
  return (
    <View className="flex-row flex-wrap gap-12">
      {(Object.keys(spec) as (keyof typeof spec)[]).map((k) => (
        <View key={k} className="flex-row items-center gap-4">
          <Icon name={spec[k].icon} size="small" color={spec[k].color} />
          <Text variant="label" weight="400" tone="secondary">
            {spec[k].label}
          </Text>
        </View>
      ))}
    </View>
  );
}
