import { Pressable, View } from "react-native";
import type { ColorName } from "@/theme/theme";
import { Icon, type IconName } from "./Icon";
import { Text, type TextTone } from "./Text";

export type SummaryTone = "red" | "yellow" | "green";

const spec: Record<SummaryTone, { box: string; tone: TextTone; icon: IconName; color: ColorName }> = {
  red: { box: "border-danger bg-danger-subtle", tone: "danger", icon: "error", color: "danger" },
  yellow: { box: "border-warning bg-warning-subtle", tone: "warning", icon: "warning", color: "warning" },
  green: { box: "border-success bg-success-subtle", tone: "success", icon: "check", color: "success" },
};

/**
 * One colour of the Review summary (owner, 29 Sep): red = fix before you can submit, yellow =
 * minor, the owner sees it, you can submit, green = checks that passed. Each line can be tapped
 * to go and check it.
 */
export function SummaryGroup({
  tone,
  title,
  lines,
}: {
  tone: SummaryTone;
  title: string;
  /** A line with onPress shows a chevron and opens where to check it. */
  lines: { text: string; key?: string; onPress?: () => void }[];
}) {
  const s = spec[tone];
  if (lines.length === 0) return null;
  return (
    <View className={`gap-4 rounded-md border px-12 py-8 ${s.box}`}>
      <View className="flex-row items-center gap-8 py-4">
        <Icon name={s.icon} color={s.color} />
        <Text variant="body" weight="600" tone={s.tone} className="min-w-0 flex-1">
          {title}
        </Text>
      </View>
      {lines.map((l, i) => (
        <Pressable
          key={l.key ?? `${i}`}
          onPress={l.onPress}
          disabled={!l.onPress}
          accessibilityRole={l.onPress ? "button" : undefined}
          className="min-h-[40px] flex-row items-center gap-8 border-t border-border py-8"
        >
          <Text variant="body" className="min-w-0 flex-1">
            {l.text}
          </Text>
          {l.onPress ? <Icon name="chevronRight" size="small" color="text-secondary" /> : null}
        </Pressable>
      ))}
    </View>
  );
}
